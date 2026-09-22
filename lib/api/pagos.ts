import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { resolveAmbitoDelegaciones, resolveDelegacion, mapaDelegaciones, type DelegacionPublica } from "@/lib/api/delegaciones"
import { cargarCatalogos } from "@/lib/api/catalogos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Pagos MCM: reembolsos a personas del movimiento (kilometraje, gastos
 * adelantados…).
 *
 * El alta por gasolina (tickets o kilometraje) tiene reglas propias que se
 * hacen mejor desde la pantalla, así que se queda ahí; exponerlas a medias
 * sería peor que no exponerlas. Pero el caso más simple y más pedido — "anota
 * que hay que pagarle esto a fulano" — no necesita ningún cálculo: es
 * `tipo_calculo: 'manual'`, y eso sí lo cubre `crearPagoMcm`. Vincular a un
 * movimiento del banco (lo que lo marca `pagado`) sigue siendo cosa de la
 * pantalla, porque además concilia la factura del ticket si la hay
 * (`conciliarFacturasDePagoConMovimiento`).
 */

export interface PagoMcmPublico {
  id: string
  concepto: string
  descripcion: string | null
  importe: number
  moneda: string
  estado: string
  tipo_calculo: string
  delegacion: DelegacionPublica | null
  contacto: { id: string; nombre: string; tipo: string | null } | null
  categoria_sugerida: { id: string; nombre: string } | null
  movimiento_id: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export interface ListarPagosParams {
  delegaciones?: string | string[] | null
  estados?: string[] | null
  contactoIds?: string[] | null
  limite?: number
  offset?: number
}

export async function listarPagosMcm(
  admin: AdminClient,
  params: ListarPagosParams = {},
): Promise<{ total: number; limite: number; offset: number; pagos: PagoMcmPublico[] }> {
  const limite = Math.min(Math.max(params.limite ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)
  const ambito = await resolveAmbitoDelegaciones(admin, params.delegaciones)

  let query = (admin as any)
    .from("pago_mcm")
    .select("*", { count: "exact" })
    .order("creado_en", { ascending: false })
    .range(offset, offset + limite - 1)

  if (ambito) query = query.in("delegacion_id", ambito.map((d) => d.id))
  if (params.estados?.length) query = query.in("estado", params.estados)
  if (params.contactoIds?.length) query = query.in("contacto_id", params.contactoIds)

  const { data, count, error } = await query
  if (error) throw wrapSupabaseError(error)

  const filas = (data ?? []) as any[]
  const [delegaciones, catalogos] = await Promise.all([
    mapaDelegaciones(admin),
    cargarCatalogos(admin),
  ])

  return {
    total: count ?? filas.length,
    limite,
    offset,
    pagos: filas.map((f) => serializePago(f, delegaciones, catalogos)),
  }
}

function serializePago(
  fila: any,
  delegaciones: Map<string, DelegacionPublica>,
  catalogos: Awaited<ReturnType<typeof cargarCatalogos>>,
): PagoMcmPublico {
  const contacto = fila.contacto_id ? catalogos.contactos.get(fila.contacto_id) : null
  const categoria = fila.categoria_id_sugerida
    ? catalogos.categorias.get(fila.categoria_id_sugerida)
    : null

  return {
    id: fila.id,
    concepto: fila.concepto,
    descripcion: fila.descripcion ?? null,
    importe: Number(fila.importe),
    moneda: fila.moneda ?? "EUR",
    estado: fila.estado,
    tipo_calculo: fila.tipo_calculo,
    delegacion: delegaciones.get(fila.delegacion_id) ?? null,
    contacto: contacto ? { id: contacto.id, nombre: contacto.nombre, tipo: contacto.tipo } : null,
    categoria_sugerida: categoria ? { id: categoria.id, nombre: categoria.nombre } : null,
    movimiento_id: fila.movimiento_id ?? null,
    notas: fila.notas ?? null,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  }
}

/** Un pago MCM por id, ya serializado. */
export async function obtenerPagoMcm(admin: AdminClient, id: string): Promise<PagoMcmPublico> {
  const fila = unwrap(await (admin as any).from("pago_mcm").select("*").eq("id", id).maybeSingle())
  if (!fila) throw notFound(`No existe ningún pago MCM con el id ${id}.`)

  const [delegaciones, catalogos] = await Promise.all([mapaDelegaciones(admin), cargarCatalogos(admin)])
  return serializePago(fila, delegaciones, catalogos)
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Estados con los que puede nacer un pago manual. 'pagado' solo se alcanza vinculando un movimiento. */
const PAGO_MCM_ESTADOS_ALTA = ["borrador", "pendiente"] as const
type PagoMcmEstadoAlta = (typeof PAGO_MCM_ESTADOS_ALTA)[number]

export interface CrearPagoMcmParams {
  delegacion: string
  /** A quién hay que pagarle (ver listar_contactos). */
  contacto_id: string
  concepto: string
  importe: number
  descripcion?: string | null
  notas?: string | null
  estado?: PagoMcmEstadoAlta | null
  categoria_id_sugerida?: string | null
}

export async function crearPagoMcm(
  admin: AdminClient,
  params: CrearPagoMcmParams,
  actorId: string | null,
): Promise<PagoMcmPublico> {
  const delegacion = await resolveDelegacion(admin, params.delegacion)

  const concepto = params.concepto?.trim()
  if (!concepto) throw badRequest("Falta el concepto: para qué es el pago.")

  const contactoId = params.contacto_id?.trim()
  if (!contactoId) {
    throw badRequest("Falta 'contacto_id': a quién hay que pagarle (ver listar_contactos).")
  }

  const importe = Number(params.importe)
  if (!Number.isFinite(importe) || importe <= 0) {
    throw badRequest("El importe de un pago MCM debe ser un número positivo.")
  }

  if (params.estado && !PAGO_MCM_ESTADOS_ALTA.includes(params.estado)) {
    throw badRequest(
      `Estado '${params.estado}' no válido al crear un pago. Un pago nace 'pendiente' (por defecto) o 'borrador'; pasa a 'pagado' solo al vincularlo con un movimiento del banco.`,
      { estados_validos: PAGO_MCM_ESTADOS_ALTA },
    )
  }

  const contacto = unwrap(
    await (admin as any).from("contacto").select("id").eq("id", contactoId).maybeSingle(),
  )
  if (!contacto) throw notFound(`No existe ningún contacto con el id ${contactoId}.`)

  const creado = unwrap(
    await (admin as any)
      .from("pago_mcm")
      .insert({
        delegacion_id: delegacion.id,
        contacto_id: contactoId,
        concepto,
        descripcion: params.descripcion?.trim() || null,
        importe,
        tipo_calculo: "manual",
        estado: params.estado || "pendiente",
        categoria_id_sugerida: params.categoria_id_sugerida || null,
        notas: params.notas?.trim() || null,
        creado_por: actorId,
      })
      .select("id")
      .single(),
  ) as any

  return obtenerPagoMcm(admin, creado.id)
}

/** Estados a los que se puede pasar un pago a mano. 'pagado' solo lo pone el trigger al vincular movimiento_id. */
const PAGO_MCM_ESTADOS_EDITABLES = ["borrador", "pendiente", "cancelado"] as const
type PagoMcmEstadoEditable = (typeof PAGO_MCM_ESTADOS_EDITABLES)[number]

export interface ActualizarPagoMcmParams {
  contacto_id?: string | null
  concepto?: string | null
  descripcion?: string | null
  importe?: number | null
  estado?: PagoMcmEstadoEditable | null
  categoria_id_sugerida?: string | null
  notas?: string | null
}

/**
 * Corrige un pago manual: concepto, importe, contacto, notas, categoría
 * sugerida, o lo cancela. Solo toca pagos con `tipo_calculo: 'manual'` —
 * los de gasolina se editan desde la pantalla, donde viven sus cálculos.
 * No permite marcarlo 'pagado' a mano: eso solo lo hace vincularlo con un
 * movimiento (desde la aplicación), que además concilia su factura si la
 * tuviera.
 */
export async function actualizarPagoMcm(
  admin: AdminClient,
  id: string,
  cambios: ActualizarPagoMcmParams,
): Promise<PagoMcmPublico> {
  const existente = unwrap(
    await (admin as any).from("pago_mcm").select("id, tipo_calculo, movimiento_id").eq("id", id).maybeSingle(),
  ) as any
  if (!existente) throw notFound(`No existe ningún pago MCM con el id ${id}.`)
  if (existente.tipo_calculo !== "manual") {
    throw badRequest(
      "Este pago se calculó por gasolina (tickets o kilometraje): se edita desde la aplicación, no desde aquí.",
    )
  }

  const updates: Record<string, unknown> = {}

  if (cambios.contacto_id !== undefined) {
    if (!cambios.contacto_id) throw badRequest("'contacto_id' no puede quedar vacío.")
    const contacto = unwrap(
      await (admin as any).from("contacto").select("id").eq("id", cambios.contacto_id).maybeSingle(),
    )
    if (!contacto) throw notFound(`No existe ningún contacto con el id ${cambios.contacto_id}.`)
    updates.contacto_id = cambios.contacto_id
  }

  if (cambios.concepto !== undefined) {
    const concepto = cambios.concepto?.trim()
    if (!concepto) throw badRequest("'concepto' no puede quedar vacío.")
    updates.concepto = concepto
  }

  if (cambios.descripcion !== undefined) updates.descripcion = cambios.descripcion?.trim() || null
  if (cambios.notas !== undefined) updates.notas = cambios.notas?.trim() || null
  if (cambios.categoria_id_sugerida !== undefined) {
    updates.categoria_id_sugerida = cambios.categoria_id_sugerida || null
  }

  if (cambios.importe !== undefined) {
    const importe = Number(cambios.importe)
    if (!Number.isFinite(importe) || importe <= 0) {
      throw badRequest("El importe de un pago MCM debe ser un número positivo.")
    }
    updates.importe = importe
  }

  if (cambios.estado !== undefined) {
    if (existente.movimiento_id) {
      throw badRequest(
        "Este pago ya está vinculado a un movimiento (pagado): desvincúlalo desde la aplicación antes de cambiarle el estado.",
      )
    }
    if (!cambios.estado || !PAGO_MCM_ESTADOS_EDITABLES.includes(cambios.estado)) {
      throw badRequest(`Estado '${cambios.estado}' no válido.`, { estados_validos: PAGO_MCM_ESTADOS_EDITABLES })
    }
    updates.estado = cambios.estado
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest(
      "No has indicado ningún cambio. Campos admitidos: contacto_id, concepto, descripcion, importe, estado, categoria_id_sugerida, notas.",
    )
  }

  const { error } = await (admin as any).from("pago_mcm").update(updates).eq("id", id)
  if (error) throw wrapSupabaseError(error)

  return obtenerPagoMcm(admin, id)
}
