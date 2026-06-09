import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, BancoSyncLogStep } from "@/lib/types/database"
import { enableBanking, EnableBankingError } from "./client"
import { mapTransactionToMovimiento } from "./dedup"

const SYNC_OVERLAP_DAYS = 10 // En cada corrida incremental, re-leemos los últimos 10 días
// Primera sync: intentamos ir lo más atrás posible. PSD2 limita el histórico persistente
// a 90 días en la mayoría de bancos; algunos permiten más con consentimientos especiales.
// Probamos en orden descendente hasta que el ASPSP acepte.
const INITIAL_WINDOWS_DAYS = [730, 365, 180, 90] as const
const DEFAULT_MAX_PAGES = 50

type AdminClient = SupabaseClient<Database>

export type SyncCuentaResult = {
  cuenta_id: string
  log_id: string
  estado: "ok" | "error" | "parcial"
  recibidas: number
  insertadas: number
  duplicadas: number
  errores: number
  date_from: string | null
  date_to: string | null
  error_mensaje?: string | null
  log: BancoSyncLogStep[]
  /** Preview de los movimientos insertados (cap 200) para mostrar resumen en UI */
  movimientos_insertados: Array<{ fecha: string; concepto: string | null; importe: number }>
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface ReconcileLogger {
  info: (msg: string, data?: Record<string, unknown>) => void
  warn: (msg: string, data?: Record<string, unknown>) => void
}

/**
 * Para cada movimiento recien insertado (gasto), busca un unico pago MCM pendiente
 * que case por importe absoluto y fecha (+/-3 dias). Si hay un unico match, vincula
 * ambos lados (movimiento.pago_mcm_id y pago_mcm.movimiento_id) — el trigger pone
 * el pago en 'pagado'. Si hay 0 o varios candidatos, no toca nada.
 *
 * Best-effort: no lanza si algo falla.
 */
async function autoLinkPagosMcm(
  admin: AdminClient,
  movimientos: Array<{
    id: string
    fecha: string
    importe: number
    contacto_id: string | null
    pago_mcm_id: string | null
  }>,
  delegacionId: string,
  logger: ReconcileLogger,
): Promise<number> {
  let vinculados = 0
  const VENTANA_DIAS = 3

  for (const mov of movimientos) {
    if (mov.pago_mcm_id) continue // ya vinculado
    if (mov.importe >= 0) continue // solo gastos
    const importeAbs = Math.abs(Number(mov.importe))
    if (!(importeAbs > 0)) continue

    const fechaMov = new Date(mov.fecha)
    if (Number.isNaN(fechaMov.getTime())) continue
    const desde = new Date(fechaMov)
    desde.setDate(desde.getDate() - VENTANA_DIAS)
    const hasta = new Date(fechaMov)
    hasta.setDate(hasta.getDate() + VENTANA_DIAS)
    const desdeIso = desde.toISOString().slice(0, 10)
    const hastaIso = hasta.toISOString().slice(0, 10)

    // Buscar pagos MCM pendientes con mismo importe absoluto. Filtramos por
    // ventana de creacion del pago (creado_en) para evitar matches con pagos
    // futuros: tipicamente el pago se crea ANTES del movimiento bancario real.
    let query = (admin as any)
      .from("pago_mcm")
      .select("id, contacto_id, creado_en, importe")
      .eq("delegacion_id", delegacionId)
      .eq("estado", "pendiente")
      .is("movimiento_id", null)
      .eq("importe", importeAbs)
      .lte("creado_en", `${hastaIso}T23:59:59`)
      .gte("creado_en", `${desdeIso}T00:00:00`)

    if (mov.contacto_id) {
      query = query.eq("contacto_id", mov.contacto_id)
    }

    const { data: candidatos, error } = await query
    if (error || !Array.isArray(candidatos)) continue

    if (candidatos.length !== 1) {
      if (candidatos.length > 1) {
        logger.info("Auto-vinculo descartado: varios candidatos", {
          movimiento_id: mov.id,
          candidatos: candidatos.length,
        })
      }
      continue
    }

    const pago = candidatos[0] as { id: string }

    const { error: e1 } = await (admin as any)
      .from("pago_mcm")
      .update({ movimiento_id: mov.id })
      .eq("id", pago.id)
    if (e1) {
      logger.warn("Auto-vinculo: error actualizando pago_mcm", { error: e1.message })
      continue
    }

    const { error: e2 } = await (admin as any)
      .from("movimiento")
      .update({ pago_mcm_id: pago.id })
      .eq("id", mov.id)
    if (e2) {
      // rollback best-effort
      await (admin as any).from("pago_mcm").update({ movimiento_id: null }).eq("id", pago.id)
      logger.warn("Auto-vinculo: error actualizando movimiento", { error: e2.message })
      continue
    }

    vinculados += 1
  }

  return vinculados
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// Prioridad de tipos de balance de Enable Banking (ISO 20022). Buscamos el
// saldo "contable actual": cerrado contabilizado (CLBD) o provisional
// contabilizado (ITBD) antes que los disponibles, que pueden incluir
// retenciones todavía no contabilizadas.
const BALANCE_TYPE_PRIORITY = ["CLBD", "ITBD", "PRCD", "XPCD", "OTHR", "CLAV", "ITAV"]

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Saldo inicial automático. En la PRIMERA sync de una cuenta, Enable Banking
 * solo trae movimientos desde `sync_desde_fecha`; lo anterior no existe en la
 * app, así que la suma de movimientos NO cuadra con el saldo real del banco.
 *
 * Pedimos el balance actual al banco y calculamos:
 *   saldo_inicial = balance_actual − suma(todos los movimientos de la cuenta)
 *
 * Insertamos un movimiento "Saldo inicial" con fecha = día anterior al primer
 * movimiento. Idempotente vía external_id = `opening:<cuenta_id>`: si ya existe
 * no se duplica (constraint UNIQUE cuenta_id, external_id).
 *
 * Best-effort: si el banco no devuelve balances o algo falla, se avisa en el
 * log pero la sync no se rompe.
 */
async function ensureSaldoInicial(
  admin: AdminClient,
  cuenta: { id: string; delegacion_id: string; external_account_uid: string },
  logger: SyncLogger,
  creadoPor: string,
): Promise<number | null> {
  const openingExternalId = `opening:${cuenta.id}`

  // ¿Ya existe el saldo inicial? (idempotencia)
  const { data: existente } = await admin
    .from("movimiento")
    .select("id")
    .eq("cuenta_id", cuenta.id)
    .eq("external_id", openingExternalId)
    .maybeSingle()
  if (existente) {
    logger.info("Saldo inicial ya existe, no se recalcula")
    return null
  }

  // 1. Balance actual del banco
  let balances
  try {
    balances = await enableBanking.getBalances(cuenta.external_account_uid)
  } catch (err) {
    logger.warn("No se pudieron obtener balances para el saldo inicial (no bloqueante)", {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }

  if (!balances?.balances?.length) {
    logger.warn("El banco no devolvió balances; no se puede calcular saldo inicial")
    return null
  }

  // Elegir el balance contable actual según prioridad
  const sorted = [...balances.balances].sort((a, b) => {
    const ia = BALANCE_TYPE_PRIORITY.indexOf(a.balance_type || "")
    const ib = BALANCE_TYPE_PRIORITY.indexOf(b.balance_type || "")
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const elegido = sorted[0]
  const balanceActual = parseFloat(elegido.balance_amount.amount)
  if (!Number.isFinite(balanceActual)) {
    logger.warn("Balance no numérico; no se puede calcular saldo inicial", { balance: elegido })
    return null
  }

  // 2. Suma de todos los movimientos actuales de la cuenta
  const { data: movs, error: sumErr } = await admin
    .from("movimiento")
    .select("importe, fecha")
    .eq("cuenta_id", cuenta.id)
  if (sumErr) {
    logger.warn("No se pudo sumar movimientos para el saldo inicial", { error: sumErr.message })
    return null
  }
  const sumaMovimientos = round2((movs || []).reduce((acc, m) => acc + Number(m.importe), 0))

  // 3. saldo_inicial = balance_actual − suma_movimientos
  const saldoInicial = round2(balanceActual - sumaMovimientos)

  logger.info("Cálculo de saldo inicial", {
    balance_actual: balanceActual,
    balance_type: elegido.balance_type,
    suma_movimientos: sumaMovimientos,
    saldo_inicial: saldoInicial,
  })

  // Si el saldo inicial es ~0, no insertamos (la cuenta arrancaba a 0)
  if (Math.abs(saldoInicial) < 0.01) {
    logger.info("Saldo inicial ≈ 0, no se inserta movimiento")
    return 0
  }

  // 4. Fecha: día anterior al primer movimiento
  const fechas = (movs || []).map((m) => m.fecha).filter(Boolean).sort()
  let fechaSaldo: string
  if (fechas.length > 0) {
    const primera = new Date(fechas[0])
    primera.setUTCDate(primera.getUTCDate() - 1)
    fechaSaldo = iso(primera)
  } else {
    fechaSaldo = iso(new Date())
  }

  const { error: insErr } = await admin.from("movimiento").insert({
    cuenta_id: cuenta.id,
    delegacion_id: cuenta.delegacion_id,
    fecha: fechaSaldo,
    concepto: "Saldo inicial",
    descripcion: `Calculado automáticamente: saldo del banco (${balanceActual}) menos la suma de movimientos importados (${sumaMovimientos}).`,
    importe: saldoInicial,
    external_id: openingExternalId,
    origen_sync: "enablebanking",
    creado_por: creadoPor,
  })
  if (insErr) {
    logger.warn("Error al insertar saldo inicial", { error: insErr.message })
    return null
  }

  logger.info(`Saldo inicial insertado: ${saldoInicial} con fecha ${fechaSaldo}`)
  return saldoInicial
}

class SyncLogger {
  steps: BancoSyncLogStep[] = []
  push(level: BancoSyncLogStep["level"], msg: string, data?: Record<string, unknown>) {
    this.steps.push({ t: new Date().toISOString(), level, msg, data })
  }
  info(msg: string, data?: Record<string, unknown>) {
    this.push("info", msg, data)
  }
  warn(msg: string, data?: Record<string, unknown>) {
    this.push("warn", msg, data)
  }
  error(msg: string, data?: Record<string, unknown>) {
    this.push("error", msg, data)
  }
  debug(msg: string, data?: Record<string, unknown>) {
    this.push("debug", msg, data)
  }
}

/**
 * Sincroniza una cuenta concreta. Crea una fila en banco_sync_log al inicio
 * y la actualiza al final con el resumen + log completo.
 */
export async function syncCuenta(
  admin: AdminClient,
  cuentaId: string,
  opts: { trigger: "cron" | "manual"; iniciadoPor?: string | null } = { trigger: "cron" },
): Promise<SyncCuentaResult> {
  const logger = new SyncLogger()
  const startedAt = new Date()
  logger.info("Arranque de sync", { cuenta_id: cuentaId, trigger: opts.trigger })

  // 1. Cargar cuenta + conexión
  const { data: cuenta, error: cuentaErr } = await admin
    .from("cuenta")
    .select(
      "id, delegacion_id, nombre, sync_enabled, external_account_uid, banco_conexion_id, last_sync_at, sync_desde_fecha",
    )
    .eq("id", cuentaId)
    .single()

  if (cuentaErr || !cuenta) {
    throw new Error(`No se pudo cargar la cuenta ${cuentaId}: ${cuentaErr?.message}`)
  }
  if (!cuenta.external_account_uid || !cuenta.banco_conexion_id) {
    throw new Error(`La cuenta ${cuenta.nombre} no está conectada a Enable Banking`)
  }

  const { data: conexion, error: conexErr } = await admin
    .from("banco_conexion")
    .select("id, session_id, aspsp_name, aspsp_country, estado, consent_valid_until")
    .eq("id", cuenta.banco_conexion_id)
    .single()

  if (conexErr || !conexion) {
    throw new Error(`No se pudo cargar la conexión: ${conexErr?.message}`)
  }
  if (!conexion.session_id) {
    throw new Error("La conexión no tiene session_id. ¿Callback fallido?")
  }
  if (new Date(conexion.consent_valid_until) < new Date()) {
    throw new Error(
      `El consentimiento expiró el ${conexion.consent_valid_until}. Renueva la conexión.`,
    )
  }

  logger.info("Cuenta y conexión cargadas", {
    aspsp: conexion.aspsp_name,
    country: conexion.aspsp_country,
    session_id_preview: conexion.session_id.slice(0, 8) + "...",
    consent_valid_until: conexion.consent_valid_until,
  })

  // 2. Ventana de fechas
  const dateTo = iso(new Date())
  const isFirstSync = !cuenta.last_sync_at
  let dateFrom: string
  // Lista ordenada de ventanas a probar. En sync incremental hay una sola (last_sync_at - 10d).
  // En primera sync probamos 2 años → 1 año → 6 meses → 90 días.
  let candidateWindows: string[]
  if (cuenta.last_sync_at) {
    const overlap = new Date(cuenta.last_sync_at)
    overlap.setUTCDate(overlap.getUTCDate() - SYNC_OVERLAP_DAYS)
    dateFrom = iso(overlap)
    candidateWindows = [dateFrom]
  } else if (cuenta.sync_desde_fecha) {
    dateFrom = cuenta.sync_desde_fecha
    // Si el usuario ha pedido una fecha concreta, la respetamos sin fallback automático.
    candidateWindows = [dateFrom]
  } else {
    candidateWindows = INITIAL_WINDOWS_DAYS.map((d) => iso(daysAgo(d)))
    dateFrom = candidateWindows[0]
  }
  logger.info("Ventana de sync", {
    date_from: dateFrom,
    date_to: dateTo,
    primera_sync: isFirstSync,
    candidatas: candidateWindows.length > 1 ? candidateWindows : undefined,
  })

  // 3. Crear log row
  const { data: logRow, error: logErr } = await admin
    .from("banco_sync_log")
    .insert({
      cuenta_id: cuenta.id,
      banco_conexion_id: conexion.id,
      trigger: opts.trigger,
      iniciado_por: opts.iniciadoPor ?? null,
      started_at: startedAt.toISOString(),
      date_from: dateFrom,
      date_to: dateTo,
      estado: "en_curso",
      log: logger.steps as unknown,
    })
    .select("id")
    .single()

  if (logErr || !logRow) {
    throw new Error(`No se pudo crear banco_sync_log: ${logErr?.message}`)
  }

  let recibidas = 0
  let insertadas = 0
  let duplicadas = 0
  let errores = 0
  let estado: "ok" | "error" | "parcial" = "ok"
  let errorMensaje: string | null = null
  let movimientosInsertados: Array<{ fecha: string; concepto: string | null; importe: number }> = []

  try {
    // 4. Verificar sesión viva
    try {
      const session = await enableBanking.getSession(conexion.session_id)
      logger.info("Sesión válida", {
        accounts_count: session.accounts.length,
        access_valid_until: session.access.valid_until,
      })
    } catch (err) {
      if (err instanceof EnableBankingError && (err.status === 401 || err.status === 404)) {
        logger.error("Sesión EB expirada o inválida", { status: err.status, body: err.body })
        await admin
          .from("banco_conexion")
          .update({ estado: "expirada", ultimo_error: "Sesión EB no válida (401/404)" })
          .eq("id", conexion.id)
        throw new Error("Sesión EB expirada. Renueva la conexión.")
      }
      throw err
    }

    // 5. Paginar transacciones con fallback de ventana
    // Intentamos en orden las fechas candidatas. Si el ASPSP rechaza la más antigua
    // (típicamente 400 por date_from fuera del histórico permitido), probamos la siguiente.
    let pages: Awaited<ReturnType<typeof enableBanking.getAllTransactions>> = []
    let ventanaUsada = dateFrom
    let ventanaLimitada = false
    let ultimoErrorVentana: EnableBankingError | null = null

    for (let wi = 0; wi < candidateWindows.length; wi++) {
      const cand = candidateWindows[wi]
      try {
        logger.info(`Intento ${wi + 1}/${candidateWindows.length} con ventana desde ${cand}`)
        pages = await enableBanking.getAllTransactions(
          cuenta.external_account_uid,
          { date_from: cand, date_to: dateTo, transaction_status: "BOOK" },
          {
            maxPages: DEFAULT_MAX_PAGES,
            onPage: (page, i) => {
              logger.info(`Página ${i} recibida`, {
                transacciones: page.transactions.length,
                tiene_continuation_key: !!page.continuation_key,
              })
            },
          },
        )
        ventanaUsada = cand
        ventanaLimitada = wi > 0
        break
      } catch (err) {
        if (err instanceof EnableBankingError && err.status === 400) {
          logger.warn(`El banco rechazó la ventana desde ${cand} (400). Probamos ventana más corta.`, {
            status: err.status,
            body: err.body,
          })
          ultimoErrorVentana = err
          continue
        }
        throw err
      }
    }

    if (pages.length === 0 && ultimoErrorVentana) {
      throw ultimoErrorVentana
    }

    dateFrom = ventanaUsada
    if (ventanaLimitada) {
      logger.warn(
        `El banco limitó el histórico a partir de ${ventanaUsada}. Para movimientos anteriores, impórtalos manualmente desde Excel (pestaña "Importar" en Transacciones).`,
        { ventana_solicitada: candidateWindows[0], ventana_obtenida: ventanaUsada },
      )
    }

    const allTx = pages.flatMap((p) => p.transactions)
    recibidas = allTx.length
    logger.info(`Total transacciones recibidas: ${recibidas}`, { desde: ventanaUsada, hasta: dateTo })

    if (allTx.length === 0) {
      logger.info("Sin transacciones nuevas en la ventana")
    } else {
      // 6. Transformar y upsert (ignoreDuplicates = true → gracias al índice único)
      const rows = allTx.map((tx) =>
        mapTransactionToMovimiento(tx, {
          cuenta_id: cuenta.id,
          delegacion_id: cuenta.delegacion_id,
          creado_por: opts.iniciadoPor ?? "00000000-0000-0000-0000-000000000000",
        }),
      )

      logger.debug("Ejemplo de transformación", {
        primera: rows[0],
        ultima: rows[rows.length - 1],
      })

      // Chequeo previo: cuáles ya existen (para contar duplicadas vs insertadas reales)
      const externalIds = rows.map((r) => r.external_id)
      const { data: existentes } = await admin
        .from("movimiento")
        .select("external_id")
        .eq("cuenta_id", cuenta.id)
        .in("external_id", externalIds)

      const existentesSet = new Set((existentes || []).map((r) => r.external_id))
      duplicadas = existentesSet.size
      const nuevas = rows.filter((r) => !existentesSet.has(r.external_id))

      if (nuevas.length > 0) {
        const { error: insertErr, count } = await admin
          .from("movimiento")
          .upsert(nuevas, { onConflict: "cuenta_id,external_id", ignoreDuplicates: true, count: "exact" })

        if (insertErr) {
          logger.error("Error al upsert", { error: insertErr.message })
          errores = nuevas.length
          estado = "parcial"
        } else {
          insertadas = count ?? nuevas.length
          movimientosInsertados = nuevas
            .slice(0, 200)
            .map((r) => ({ fecha: r.fecha, concepto: r.concepto ?? null, importe: Number(r.importe) }))
        }
      }

      // Reconciliacion automatica con pagos MCM pendientes:
      // para cada gasto recien importado, si existe UN unico pago MCM pendiente
      // con el mismo importe absoluto y fecha dentro de ventana de +/-3 dias,
      // se vincula automaticamente. Si hay varios candidatos no toca nada.
      try {
        const externalIdsNuevas = nuevas.map((r) => r.external_id)
        if (externalIdsNuevas.length > 0) {
          const { data: insertadosRows } = await admin
            .from("movimiento")
            .select("id, fecha, importe, contacto_id, pago_mcm_id")
            .eq("cuenta_id", cuenta.id)
            .in("external_id", externalIdsNuevas)
          const reconciliados = await autoLinkPagosMcm(
            admin,
            (insertadosRows ?? []) as Array<{
              id: string
              fecha: string
              importe: number
              contacto_id: string | null
              pago_mcm_id: string | null
            }>,
            cuenta.delegacion_id,
            logger,
          )
          if (reconciliados > 0) {
            logger.info(`Pagos MCM auto-vinculados: ${reconciliados}`)
          }
        }
      } catch (err) {
        // best-effort: no rompemos la sync si la reconciliacion falla
        logger.warn("Fallo al auto-vincular pagos MCM (no bloqueante)", {
          error: err instanceof Error ? err.message : String(err),
        })
      }

      logger.info("Resumen", { recibidas, insertadas, duplicadas, errores })
    }

    // 6.5 Saldo inicial automático (solo primera sync). Best-effort: no rompe la sync.
    if (isFirstSync) {
      try {
        await ensureSaldoInicial(
          admin,
          {
            id: cuenta.id,
            delegacion_id: cuenta.delegacion_id,
            external_account_uid: cuenta.external_account_uid,
          },
          logger,
          opts.iniciadoPor ?? "00000000-0000-0000-0000-000000000000",
        )
      } catch (err) {
        logger.warn("Fallo al calcular saldo inicial (no bloqueante)", {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // 7. Actualizar cuenta
    await admin
      .from("cuenta")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: estado,
        last_sync_error: null,
      })
      .eq("id", cuenta.id)
  } catch (err) {
    estado = "error"
    errorMensaje = err instanceof Error ? err.message : String(err)
    logger.error("Sync falló", { mensaje: errorMensaje })
    await admin
      .from("cuenta")
      .update({ last_sync_status: "error", last_sync_error: errorMensaje })
      .eq("id", cuenta.id)
  } finally {
    const finishedAt = new Date()
    await admin
      .from("banco_sync_log")
      .update({
        finished_at: finishedAt.toISOString(),
        duracion_ms: finishedAt.getTime() - startedAt.getTime(),
        date_from: dateFrom,
        date_to: dateTo,
        transacciones_recibidas: recibidas,
        transacciones_insertadas: insertadas,
        transacciones_duplicadas: duplicadas,
        transacciones_error: errores,
        estado,
        error_mensaje: errorMensaje,
        log: logger.steps as unknown,
      })
      .eq("id", logRow.id)
  }

  return {
    cuenta_id: cuenta.id,
    log_id: logRow.id,
    estado,
    recibidas,
    insertadas,
    duplicadas,
    errores,
    date_from: dateFrom,
    date_to: dateTo,
    error_mensaje: errorMensaje,
    log: logger.steps,
    movimientos_insertados: movimientosInsertados,
  }
}

/**
 * Sincroniza TODAS las cuentas con sync_enabled=true cuyo consentimiento esté vivo.
 * Pensado para el cron. Cada cuenta se procesa de forma independiente — un fallo
 * no corta el resto.
 */
export async function syncTodasLasCuentas(
  admin: AdminClient,
): Promise<{ resultados: Array<Pick<SyncCuentaResult, "cuenta_id" | "estado" | "insertadas" | "error_mensaje">> }> {
  const { data: cuentas, error } = await admin
    .from("cuenta")
    .select("id, banco_conexion_id, banco_conexion:banco_conexion_id(estado, consent_valid_until)")
    .eq("sync_enabled", true)
    .not("banco_conexion_id", "is", null)

  if (error) throw new Error(`Error listando cuentas: ${error.message}`)

  const resultados: Array<Pick<SyncCuentaResult, "cuenta_id" | "estado" | "insertadas" | "error_mensaje">> = []
  const now = new Date()

  for (const c of cuentas || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn: any = Array.isArray((c as any).banco_conexion) ? (c as any).banco_conexion[0] : (c as any).banco_conexion
    if (!conn || conn.estado !== "autorizada" || new Date(conn.consent_valid_until) < now) {
      resultados.push({
        cuenta_id: c.id,
        estado: "error",
        insertadas: 0,
        error_mensaje: "Consentimiento no activo / expirado",
      })
      continue
    }
    try {
      const r = await syncCuenta(admin, c.id, { trigger: "cron" })
      resultados.push({
        cuenta_id: r.cuenta_id,
        estado: r.estado,
        insertadas: r.insertadas,
        error_mensaje: r.error_mensaje,
      })
    } catch (err) {
      resultados.push({
        cuenta_id: c.id,
        estado: "error",
        insertadas: 0,
        error_mensaje: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { resultados }
}
