import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, BancoSyncLogStep } from "@/lib/types/database"
import { enableBanking, EnableBankingError } from "./client"
import { mapTransactionToMovimiento } from "./dedup"

const SYNC_OVERLAP_DAYS = 10 // Re-leemos los últimos 10 días en cada corrida
const DEFAULT_INITIAL_DAYS = 90 // Primera sync: 90 días atrás por defecto
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
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
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
  let dateFrom: string
  if (cuenta.last_sync_at) {
    const overlap = new Date(cuenta.last_sync_at)
    overlap.setUTCDate(overlap.getUTCDate() - SYNC_OVERLAP_DAYS)
    dateFrom = iso(overlap)
  } else if (cuenta.sync_desde_fecha) {
    dateFrom = cuenta.sync_desde_fecha
  } else {
    dateFrom = iso(daysAgo(DEFAULT_INITIAL_DAYS))
  }
  logger.info("Ventana de sync", { date_from: dateFrom, date_to: dateTo })

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

    // 5. Paginar transacciones
    const pages = await enableBanking.getAllTransactions(
      cuenta.external_account_uid,
      { date_from: dateFrom, date_to: dateTo, transaction_status: "BOOK" },
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

    const allTx = pages.flatMap((p) => p.transactions)
    recibidas = allTx.length
    logger.info(`Total transacciones recibidas: ${recibidas}`)

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
        }
      }

      logger.info("Resumen", { recibidas, insertadas, duplicadas, errores })
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
