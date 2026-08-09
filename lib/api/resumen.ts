import type { createAdminClient } from "@/lib/supabase/admin"
import { wrapSupabaseError } from "@/lib/api/errors"
import {
  listDelegaciones,
  resolveAmbitoDelegaciones,
  type DelegacionPublica,
} from "@/lib/api/delegaciones"
import { cargarCatalogos } from "@/lib/api/catalogos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Foto económica de una, varias o todas las delegaciones.
 *
 * Las funciones de agregación que ya existen en Postgres (`get_financial_summary`,
 * `get_saldos_por_cuenta`…) llevan un `assert_delegacion_member` que comprueba
 * `auth.uid()`, así que no sirven con la clave de servicio: no hay usuario
 * detrás. Se agrega aquí, paginando y sumando. A la escala de MCM (miles de
 * movimientos) son un par de peticiones; si algún día crece, esto es lo primero
 * que debería convertirse en una función SQL con su propio permiso.
 */

const PAGINA = 1000
const MAX_FILAS = 40_000

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ResumenDelegacion {
  delegacion: DelegacionPublica
  movimientos: number
  ingresos: number
  gastos: number
  neto: number
  /** Saldo acumulado de todas las cuentas activas (todo el histórico). */
  saldo: number | null
  cuentas: number
  facturas_pendientes: number
  avisos_pendientes: number
}

export interface ResumenCategoria {
  categoria: { id: string; nombre: string; emoji: string | null; color: string | null } | null
  movimientos: number
  ingresos: number
  gastos: number
  neto: number
}

export interface ResumenGeneral {
  desde: string | null
  hasta: string | null
  totales: {
    delegaciones: number
    movimientos: number
    ingresos: number
    gastos: number
    neto: number
    saldo: number
  }
  truncado: boolean
  por_delegacion: ResumenDelegacion[]
  por_categoria: ResumenCategoria[]
}

interface FilaAgregable {
  delegacion_id: string | null
  categoria_id: string | null
  cuenta_id: string | null
  importe: number
  fecha: string
  ignorado: boolean
}

/** Trae las columnas mínimas de los movimientos del ámbito, paginando. */
async function traerFilas(
  admin: AdminClient,
  delegacionIds: string[] | null,
): Promise<{ filas: FilaAgregable[]; truncado: boolean }> {
  const filas: FilaAgregable[] = []

  for (let desde = 0; desde < MAX_FILAS; desde += PAGINA) {
    let query = (admin as any)
      .from("movimiento")
      .select("delegacion_id, categoria_id, cuenta_id, importe, fecha, ignorado")
      // Orden por `id` (único): con un orden no estable las páginas se solapan
      // y los totales saldrían mal.
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA - 1)

    if (delegacionIds) query = query.in("delegacion_id", delegacionIds)

    const { data, error } = await query
    if (error) throw wrapSupabaseError(error)

    const pagina = (data ?? []) as FilaAgregable[]
    filas.push(...pagina)
    if (pagina.length < PAGINA) return { filas, truncado: false }
  }

  return { filas, truncado: true }
}

export interface ResumenParams {
  delegaciones?: string | string[] | null
  desde?: string | null
  hasta?: string | null
  /** Incluir en ingresos/gastos los movimientos marcados como ignorados. */
  incluirIgnorados?: boolean
}

export async function resumenGeneral(
  admin: AdminClient,
  params: ResumenParams = {},
): Promise<ResumenGeneral> {
  const ambito = await resolveAmbitoDelegaciones(admin, params.delegaciones)
  const delegaciones = ambito ?? (await listDelegaciones(admin))
  const catalogos = await cargarCatalogos(admin)

  const { filas, truncado } = await traerFilas(admin, ambito ? ambito.map((d) => d.id) : null)

  const cuentasActivas = new Set(
    [...catalogos.cuentas.values()].filter((c) => c.activa).map((c) => c.id),
  )

  const porDelegacion = new Map<string, { movimientos: number; ingresos: number; gastos: number; saldo: number }>()
  const porCategoria = new Map<string, { movimientos: number; ingresos: number; gastos: number }>()

  for (const fila of filas) {
    const importe = Number(fila.importe)
    const clave = fila.delegacion_id ?? "sin_delegacion"
    const acumulado =
      porDelegacion.get(clave) ?? { movimientos: 0, ingresos: 0, gastos: 0, saldo: 0 }

    // El saldo refleja el extracto del banco: suma todo, también lo ignorado.
    if (fila.cuenta_id && cuentasActivas.has(fila.cuenta_id)) acumulado.saldo += importe

    const dentroDeFechas =
      (!params.desde || fila.fecha >= params.desde) && (!params.hasta || fila.fecha <= params.hasta)
    const cuenta = fila.cuenta_id ? catalogos.cuentas.get(fila.cuenta_id) : null
    const contable =
      dentroDeFechas && (params.incluirIgnorados || !fila.ignorado) && (!cuenta || cuenta.activa)

    if (contable) {
      acumulado.movimientos += 1
      if (importe >= 0) acumulado.ingresos += importe
      else acumulado.gastos += importe

      const claveCategoria = fila.categoria_id ?? "sin_categoria"
      const cat = porCategoria.get(claveCategoria) ?? { movimientos: 0, ingresos: 0, gastos: 0 }
      cat.movimientos += 1
      if (importe >= 0) cat.ingresos += importe
      else cat.gastos += importe
      porCategoria.set(claveCategoria, cat)
    }

    porDelegacion.set(clave, acumulado)
  }

  const [facturasPendientes, avisosPendientes] = await Promise.all([
    contarPorDelegacion(admin, "factura", (q) =>
      q.not("estado", "in", "(pagada,pagada_fuera)"),
    ),
    contarPorDelegacion(admin, "aviso", (q) => q.eq("estado", "pendiente")),
  ])

  const resumenDelegaciones: ResumenDelegacion[] = delegaciones.map((delegacion) => {
    const v = porDelegacion.get(delegacion.id) ?? { movimientos: 0, ingresos: 0, gastos: 0, saldo: 0 }
    return {
      delegacion,
      movimientos: v.movimientos,
      ingresos: redondear(v.ingresos),
      gastos: redondear(v.gastos),
      neto: redondear(v.ingresos + v.gastos),
      saldo: redondear(v.saldo),
      cuentas: [...catalogos.cuentas.values()].filter(
        (c) => c.delegacion_id === delegacion.id && c.activa,
      ).length,
      facturas_pendientes: facturasPendientes.get(delegacion.id) ?? 0,
      avisos_pendientes: avisosPendientes.get(delegacion.id) ?? 0,
    }
  })

  const totales = resumenDelegaciones.reduce(
    (acc, r) => ({
      delegaciones: acc.delegaciones + 1,
      movimientos: acc.movimientos + r.movimientos,
      ingresos: acc.ingresos + r.ingresos,
      gastos: acc.gastos + r.gastos,
      neto: acc.neto + r.neto,
      saldo: acc.saldo + (r.saldo ?? 0),
    }),
    { delegaciones: 0, movimientos: 0, ingresos: 0, gastos: 0, neto: 0, saldo: 0 },
  )

  return {
    desde: params.desde ?? null,
    hasta: params.hasta ?? null,
    truncado,
    totales: {
      ...totales,
      ingresos: redondear(totales.ingresos),
      gastos: redondear(totales.gastos),
      neto: redondear(totales.neto),
      saldo: redondear(totales.saldo),
    },
    por_delegacion: resumenDelegaciones.sort((a, b) => a.gastos - b.gastos),
    por_categoria: [...porCategoria.entries()]
      .map(([id, v]) => {
        const categoria = catalogos.categorias.get(id)
        return {
          categoria: categoria
            ? {
                id: categoria.id,
                nombre: categoria.nombre,
                emoji: categoria.emoji,
                color: categoria.color,
              }
            : null,
          movimientos: v.movimientos,
          ingresos: redondear(v.ingresos),
          gastos: redondear(v.gastos),
          neto: redondear(v.ingresos + v.gastos),
        }
      })
      .sort((a, b) => a.gastos - b.gastos),
  }
}

/** Cuenta filas por delegación en una tabla que tenga `delegacion_id`. */
async function contarPorDelegacion(
  admin: AdminClient,
  tabla: string,
  filtro: (q: any) => any,
): Promise<Map<string, number>> {
  const { data, error } = await filtro(
    (admin as any).from(tabla).select("delegacion_id"),
  ).limit(5000)
  if (error) throw wrapSupabaseError(error)

  const conteo = new Map<string, number>()
  for (const fila of (data ?? []) as { delegacion_id: string }[]) {
    conteo.set(fila.delegacion_id, (conteo.get(fila.delegacion_id) ?? 0) + 1)
  }
  return conteo
}
