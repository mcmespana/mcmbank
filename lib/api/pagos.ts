import type { createAdminClient } from "@/lib/supabase/admin"
import { wrapSupabaseError } from "@/lib/api/errors"
import { resolveAmbitoDelegaciones, mapaDelegaciones, type DelegacionPublica } from "@/lib/api/delegaciones"
import { cargarCatalogos } from "@/lib/api/catalogos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Pagos MCM: reembolsos a personas del movimiento (kilometraje, gastos
 * adelantados…).
 *
 * De momento la API solo los **lee**. Es la sección menos usada y su alta tiene
 * reglas propias (cálculo de gasolina, contacto obligatorio) que se hacen mejor
 * desde la pantalla; exponerlas a medias sería peor que no exponerlas. Leerlos
 * sí hace falta: al revisar movimientos conviene ver si uno corresponde a un
 * pago MCM ya registrado.
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
