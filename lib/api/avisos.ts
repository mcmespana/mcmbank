import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import {
  resolveAmbitoDelegaciones,
  resolveDelegacion,
  mapaDelegaciones,
  type DelegacionPublica,
} from "@/lib/api/delegaciones"
import { enviarNotificacionAviso } from "@/lib/services/aviso-notificaciones"
import {
  AVISO_DESTINATARIOS,
  AVISO_MAX_CONTENIDO,
  AVISO_MAX_REFERENCIA,
  AVISO_TIPOS,
  type AvisoDestinatario,
  type AvisoEstado,
  type AvisoTipo,
} from "@/lib/types/avisos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Avisos y tareas: el canal entre la oficina técnica y los tesoreros de cada
 * delegación.
 *
 * Es lo que permite decirle al agente "deja una nota a Sevilla preguntando por
 * la factura de octubre" y que aparezca en el panel de esa delegación, con
 * autor y —si se pide— con su correo.
 *
 * Un aviso vive siempre dentro de una delegación: el aislamiento entre
 * delegaciones lo garantiza RLS en la app, y aquí, que se accede con service
 * role, se respeta filtrando siempre por `delegacion_id`.
 */

export const AVISO_ESTADOS = ["pendiente", "hecha"] as const

export interface AvisoPublico {
  id: string
  tipo: AvisoTipo
  contenido: string
  referencia: string | null
  destinatario: AvisoDestinatario
  estado: AvisoEstado
  delegacion: DelegacionPublica | null
  autor: { id: string; nombre: string | null }
  completado_por: { id: string; nombre: string | null } | null
  completado_en: string | null
  notificado_en: string | null
  responsable: { id: string; nombre: string | null } | null
  fecha_limite: string | null
  urgente: boolean
  lecturas: number
  creado_en: string
  actualizado_en: string
}

const AVISO_SELECT = `
  id,
  delegacion_id,
  tipo,
  contenido,
  referencia,
  destinatario,
  estado,
  completado_por,
  completado_en,
  notificado_en,
  notificado_por,
  responsable_id,
  fecha_limite,
  urgente,
  creado_por,
  creado_en,
  actualizado_en,
  lecturas:aviso_lectura ( usuario_id )
`

/** Nombres de perfil de los usuarios implicados (autores, completadores y responsables). */
async function nombresDePerfil(
  admin: AdminClient,
  filas: any[],
): Promise<Record<string, string>> {
  const ids = Array.from(
    new Set(
      filas.flatMap((f) => [f.creado_por, f.completado_por, f.responsable_id].filter(Boolean) as string[]),
    ),
  )
  if (ids.length === 0) return {}

  const { data, error } = await (admin as any)
    .from("perfil")
    .select("usuario_id, nombre_completo")
    .in("usuario_id", ids)

  if (error) {
    // Los nombres son decorativos: si fallan, se sigue devolviendo el aviso.
    console.warn("No se pudieron cargar los nombres de perfil:", error.message)
    return {}
  }

  return (data ?? []).reduce((acc: Record<string, string>, perfil: any) => {
    const nombre = perfil?.nombre_completo?.trim()
    if (nombre) acc[perfil.usuario_id] = nombre
    return acc
  }, {})
}

function serializeAviso(
  fila: any,
  nombres: Record<string, string>,
  delegaciones: Map<string, DelegacionPublica>,
): AvisoPublico {
  const lecturas = (fila.lecturas ?? []) as { usuario_id: string }[]
  return {
    id: fila.id,
    tipo: fila.tipo as AvisoTipo,
    contenido: fila.contenido,
    referencia: fila.referencia ?? null,
    destinatario: fila.destinatario as AvisoDestinatario,
    estado: fila.estado as AvisoEstado,
    delegacion: delegaciones.get(fila.delegacion_id) ?? null,
    autor: { id: fila.creado_por, nombre: nombres[fila.creado_por] ?? null },
    completado_por: fila.completado_por
      ? { id: fila.completado_por, nombre: nombres[fila.completado_por] ?? null }
      : null,
    completado_en: fila.completado_en ?? null,
    notificado_en: fila.notificado_en ?? null,
    responsable: fila.responsable_id
      ? { id: fila.responsable_id, nombre: nombres[fila.responsable_id] ?? null }
      : null,
    fecha_limite: fila.fecha_limite ?? null,
    urgente: Boolean(fila.urgente),
    lecturas: lecturas.filter((l) => l.usuario_id !== fila.creado_por).length,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  }
}

export interface ListarAvisosParams {
  delegaciones?: string | string[] | null
  estado?: AvisoEstado | "todas" | null
  tipo?: AvisoTipo | null
  destinatario?: AvisoDestinatario | null
  texto?: string | null
  limite?: number
}

export async function listarAvisos(
  admin: AdminClient,
  params: ListarAvisosParams = {},
): Promise<{ total: number; avisos: AvisoPublico[] }> {
  const limite = Math.min(Math.max(params.limite ?? 100, 1), 300)
  const ambito = await resolveAmbitoDelegaciones(admin, params.delegaciones)

  let query = (admin as any)
    .from("aviso")
    .select(AVISO_SELECT, { count: "exact" })
    .order("creado_en", { ascending: false })
    .limit(limite)

  if (ambito) query = query.in("delegacion_id", ambito.map((d) => d.id))
  // Por defecto solo lo que sigue vivo: es lo que se quiere revisar.
  const estado = params.estado ?? "pendiente"
  if (estado !== "todas") query = query.eq("estado", estado)
  if (params.tipo) query = query.eq("tipo", params.tipo)
  if (params.destinatario) query = query.eq("destinatario", params.destinatario)
  if (params.texto?.trim()) query = query.ilike("contenido", `%${params.texto.trim()}%`)

  const { data, count, error } = await query
  if (error) throw wrapSupabaseError(error)

  const filas = (data ?? []) as any[]
  const [nombres, delegaciones] = await Promise.all([
    nombresDePerfil(admin, filas),
    mapaDelegaciones(admin),
  ])

  return {
    total: count ?? filas.length,
    avisos: filas.map((f) => serializeAviso(f, nombres, delegaciones)),
  }
}

export async function obtenerAviso(admin: AdminClient, id: string): Promise<AvisoPublico> {
  const fila = unwrap(
    await (admin as any).from("aviso").select(AVISO_SELECT).eq("id", id).maybeSingle(),
  ) as any
  if (!fila) throw notFound(`No existe ningún aviso con el id ${id}.`)

  const [nombres, delegaciones] = await Promise.all([
    nombresDePerfil(admin, [fila]),
    mapaDelegaciones(admin),
  ])
  return serializeAviso(fila, nombres, delegaciones)
}

export interface CrearAvisoParams {
  delegacion: string
  contenido: string
  tipo?: AvisoTipo | null
  destinatario?: AvisoDestinatario | null
  referencia?: string | null
  /** Enviar además el correo a los destinatarios. */
  notificar?: boolean
  /** Solo se guarda si tipo es 'tarea'. Quién tiene que hacerla. */
  responsable_id?: string | null
  /** Solo se guarda si tipo es 'tarea'. Fecha límite "yyyy-mm-dd". */
  fecha_limite?: string | null
  /** Solo se guarda si tipo es 'tarea'. Marca de prioridad. */
  urgente?: boolean | null
}

export interface CrearAvisoResultado {
  aviso: AvisoPublico
  /** Correos a los que se ha avisado, si se pidió notificar. */
  notificados?: string[]
  aviso_notificacion?: string
}

/**
 * Crea una nota o tarea en una delegación.
 *
 * `tipo` por defecto es `nota` y `destinatario` por defecto es `delegacion`,
 * que es el caso normal de esta API: la oficina técnica dejando un recado a los
 * tesoreros. Si el correo falla, el aviso ya está guardado y se devuelve con un
 * texto explicando qué pasó, en lugar de perder la nota.
 */
export async function crearAviso(
  admin: AdminClient,
  params: CrearAvisoParams,
  actorId: string,
): Promise<CrearAvisoResultado> {
  const delegacion = await resolveDelegacion(admin, params.delegacion)

  const contenido = (params.contenido ?? "").trim()
  if (!contenido) throw badRequest("El aviso no puede estar vacío.")
  if (contenido.length > AVISO_MAX_CONTENIDO) {
    throw badRequest(
      `El texto ocupa ${contenido.length} caracteres y el máximo son ${AVISO_MAX_CONTENIDO}.`,
    )
  }

  const tipo = (params.tipo ?? "nota") as AvisoTipo
  if (!AVISO_TIPOS.includes(tipo)) {
    throw badRequest(`Tipo '${tipo}' no válido.`, { tipos_validos: AVISO_TIPOS })
  }

  const destinatario = (params.destinatario ?? "delegacion") as AvisoDestinatario
  if (!AVISO_DESTINATARIOS.includes(destinatario)) {
    throw badRequest(`Destinatario '${destinatario}' no válido.`, {
      destinatarios_validos: AVISO_DESTINATARIOS,
    })
  }

  const referencia = params.referencia?.trim().slice(0, AVISO_MAX_REFERENCIA) || null
  const esTarea = tipo === "tarea"

  if (params.fecha_limite && !/^\d{4}-\d{2}-\d{2}$/.test(params.fecha_limite)) {
    throw badRequest(`fecha_limite debe tener el formato "AAAA-MM-DD", recibido '${params.fecha_limite}'.`)
  }

  const fila = unwrap(
    await (admin as any)
      .from("aviso")
      .insert({
        delegacion_id: delegacion.id,
        tipo,
        contenido,
        referencia,
        destinatario,
        creado_por: actorId,
        responsable_id: esTarea ? params.responsable_id ?? null : null,
        fecha_limite: esTarea ? params.fecha_limite ?? null : null,
        urgente: esTarea ? Boolean(params.urgente) : false,
      })
      .select(AVISO_SELECT)
      .single(),
  ) as any

  const resultado: CrearAvisoResultado = { aviso: await hidratar(admin, fila) }

  if (params.notificar) {
    try {
      const { destinatarios } = await enviarNotificacionAviso(admin, fila, {
        marcarNotificadoPor: actorId,
      })
      resultado.notificados = destinatarios
    } catch (err) {
      resultado.aviso_notificacion = `El aviso se guardó, pero el correo no salió: ${
        err instanceof Error ? err.message : String(err)
      }`
    }
  }

  return resultado
}

export interface ActualizarAvisoParams {
  contenido?: string | null
  referencia?: string | null
  destinatario?: AvisoDestinatario | null
  estado?: AvisoEstado | null
  /** Quién tiene que hacer la tarea. Pasa null para quitar el responsable. */
  responsable_id?: string | null
  /** Fecha límite "yyyy-mm-dd". Pasa null para quitarla. */
  fecha_limite?: string | null
  urgente?: boolean | null
}

export async function actualizarAviso(
  admin: AdminClient,
  id: string,
  cambios: ActualizarAvisoParams,
  actorId: string,
): Promise<AvisoPublico> {
  const existente = unwrap(
    await (admin as any).from("aviso").select("id, estado").eq("id", id).maybeSingle(),
  ) as any
  if (!existente) throw notFound(`No existe ningún aviso con el id ${id}.`)

  const updates: Record<string, unknown> = {}

  if (cambios.contenido !== undefined && cambios.contenido !== null) {
    const contenido = cambios.contenido.trim()
    if (!contenido) throw badRequest("El aviso no puede quedarse vacío.")
    if (contenido.length > AVISO_MAX_CONTENIDO) {
      throw badRequest(`El texto no puede pasar de ${AVISO_MAX_CONTENIDO} caracteres.`)
    }
    updates.contenido = contenido
  }
  if (cambios.referencia !== undefined) {
    updates.referencia = cambios.referencia?.trim().slice(0, AVISO_MAX_REFERENCIA) || null
  }
  if (cambios.destinatario) {
    if (!AVISO_DESTINATARIOS.includes(cambios.destinatario)) {
      throw badRequest(`Destinatario '${cambios.destinatario}' no válido.`, {
        destinatarios_validos: AVISO_DESTINATARIOS,
      })
    }
    updates.destinatario = cambios.destinatario
  }
  if (cambios.estado) {
    if (!AVISO_ESTADOS.includes(cambios.estado)) {
      throw badRequest(`Estado '${cambios.estado}' no válido.`, { estados_validos: AVISO_ESTADOS })
    }
    updates.estado = cambios.estado
    updates.completado_por = cambios.estado === "hecha" ? actorId : null
  }
  if (cambios.responsable_id !== undefined) {
    updates.responsable_id = cambios.responsable_id
  }
  if (cambios.fecha_limite !== undefined) {
    if (cambios.fecha_limite && !/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha_limite)) {
      throw badRequest(`fecha_limite debe tener el formato "AAAA-MM-DD", recibido '${cambios.fecha_limite}'.`)
    }
    updates.fecha_limite = cambios.fecha_limite
  }
  if (cambios.urgente !== undefined && cambios.urgente !== null) {
    updates.urgente = Boolean(cambios.urgente)
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest(
      "No has indicado ningún cambio. Campos admitidos: contenido, referencia, destinatario, estado, responsable_id, fecha_limite, urgente.",
    )
  }

  const { error } = await (admin as any).from("aviso").update(updates).eq("id", id)
  if (error) throw wrapSupabaseError(error)

  return obtenerAviso(admin, id)
}

export interface AsignableAviso {
  id: string
  nombre: string | null
}

/**
 * Quién se puede asignar como responsable de una tarea: tesoreros de la
 * delegación si va dirigida a ella, o gestores centrales (globales) si va
 * dirigida a la oficina técnica. Mismo criterio que los destinatarios del correo.
 */
export async function listarAsignablesAviso(
  admin: AdminClient,
  delegacionRef: string,
  destinatario: AvisoDestinatario,
): Promise<AsignableAviso[]> {
  const delegacion = await resolveDelegacion(admin, delegacionRef)

  let query = (admin as any).from("membresia").select("usuario_id")
  query =
    destinatario === "delegacion"
      ? query.eq("delegacion_id", delegacion.id).eq("rol", "tesorero")
      : query.eq("rol", "gestor_central")

  const { data, error } = await query
  if (error) throw wrapSupabaseError(error)

  const ids: string[] = Array.from(new Set((data ?? []).map((m: any) => String(m.usuario_id))))
  if (ids.length === 0) return []

  const nombres = await nombresDePerfil(admin, ids.map((id) => ({ creado_por: id })))
  return ids
    .map((id): AsignableAviso => ({ id, nombre: nombres[id] ?? null }))
    .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""))
}

export async function eliminarAviso(admin: AdminClient, id: string): Promise<void> {
  const existente = unwrap(
    await (admin as any).from("aviso").select("id").eq("id", id).maybeSingle(),
  )
  if (!existente) throw notFound(`No existe ningún aviso con el id ${id}.`)

  const { error } = await (admin as any).from("aviso").delete().eq("id", id)
  if (error) throw wrapSupabaseError(error)
}

/** Envía (o reenvía) por correo un aviso ya creado. */
export async function notificarAviso(
  admin: AdminClient,
  id: string,
  actorId: string,
): Promise<{ destinatarios: string[] }> {
  const fila = unwrap(
    await (admin as any)
      .from("aviso")
      .select("id, delegacion_id, tipo, contenido, referencia, destinatario, creado_por")
      .eq("id", id)
      .maybeSingle(),
  ) as any
  if (!fila) throw notFound(`No existe ningún aviso con el id ${id}.`)

  return enviarNotificacionAviso(admin, fila, { marcarNotificadoPor: actorId })
}

async function hidratar(admin: AdminClient, fila: any): Promise<AvisoPublico> {
  const [nombres, delegaciones] = await Promise.all([
    nombresDePerfil(admin, [fila]),
    mapaDelegaciones(admin),
  ])
  return serializeAviso(fila, nombres, delegaciones)
}
