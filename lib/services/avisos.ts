import { supabase } from "@/lib/supabase/client"
import type {
  Aviso,
  AvisoDestinatario,
  AvisoEstado,
  AvisoRow,
  AvisoTipo,
  AvisoUpdate,
  NuevoAviso,
} from "@/lib/types/avisos"
import { AVISO_MAX_CONTENIDO, AVISO_MAX_REFERENCIA } from "@/lib/types/avisos"

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
  creado_por,
  creado_en,
  actualizado_en,
  lecturas:aviso_lectura ( usuario_id )
`

type AvisoRowConLecturas = AvisoRow & { lecturas?: { usuario_id: string }[] | null }

export interface ListarAvisosOptions {
  /** Incluir también los ya hechos/archivados (para la pestaña "Hechos"). */
  incluirHechos?: boolean
  limite?: number
  signal?: AbortSignal
}

export interface ListarAvisosContexto {
  /** Usuario actual. */
  usuarioId: string
  /** Lado del usuario en esta delegación: define qué avisos son "para mí". */
  miLado: AvisoDestinatario
}

/**
 * Avisos y tareas de una delegación, ya resueltos para la UI (autoría, lecturas
 * y si me afectan). El aislamiento por delegación lo garantiza RLS; aquí solo
 * filtramos por delegacion_id para no traer de más.
 */
export const AvisosService = {
  async listar(
    delegacionId: string,
    ctx: ListarAvisosContexto,
    options: ListarAvisosOptions = {},
  ): Promise<Aviso[]> {
    const client = supabase as any
    let query = client
      .from("aviso")
      .select(AVISO_SELECT)
      .eq("delegacion_id", delegacionId)
      .order("creado_en", { ascending: false })
      .limit(options.limite ?? 120)

    if (!options.incluirHechos) {
      query = query.eq("estado", "pendiente")
    }
    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as AvisoRowConLecturas[]
    const nombres = await fetchNombres(rows, options.signal)

    return rows.map((row) => mapAviso(row, ctx, nombres))
  },

  async crear(delegacionId: string, usuarioId: string, payload: NuevoAviso): Promise<Aviso> {
    const contenido = payload.contenido.trim()
    if (!contenido) throw new Error("El aviso no puede estar vacío")
    if (contenido.length > AVISO_MAX_CONTENIDO) {
      throw new Error(`El texto no puede pasar de ${AVISO_MAX_CONTENIDO} caracteres`)
    }

    const referencia = payload.referencia?.trim().slice(0, AVISO_MAX_REFERENCIA) || null

    const client = supabase as any
    const { data, error } = await client
      .from("aviso")
      .insert({
        delegacion_id: delegacionId,
        tipo: payload.tipo,
        contenido,
        referencia,
        destinatario: payload.destinatario,
        creado_por: usuarioId,
      })
      .select(AVISO_SELECT)
      .single()

    if (error) throw error

    const row = data as AvisoRowConLecturas
    const nombres = await fetchNombres([row])
    return mapAviso(row, { usuarioId, miLado: payload.destinatario }, nombres)
  },

  async cambiarEstado(id: string, estado: AvisoEstado, usuarioId?: string): Promise<void> {
    const client = supabase as any
    const updates: AvisoUpdate =
      estado === "hecha" ? { estado, completado_por: usuarioId ?? null } : { estado }
    const { error } = await client.from("aviso").update(updates).eq("id", id)
    if (error) throw error
  },

  async editar(id: string, updates: Pick<AvisoUpdate, "contenido" | "referencia" | "destinatario">): Promise<void> {
    const client = supabase as any
    const { error } = await client.from("aviso").update(updates).eq("id", id)
    if (error) throw error
  },

  async eliminar(id: string): Promise<void> {
    const client = supabase as any
    const { error } = await client.from("aviso").delete().eq("id", id)
    if (error) throw error
  },

  /** Marca como leídos los avisos indicados para el usuario actual (idempotente). */
  async marcarLeidos(avisoIds: string[], usuarioId: string): Promise<void> {
    if (avisoIds.length === 0) return
    const client = supabase as any
    const { error } = await client
      .from("aviso_lectura")
      .upsert(
        avisoIds.map((aviso_id) => ({ aviso_id, usuario_id: usuarioId })),
        { onConflict: "aviso_id,usuario_id", ignoreDuplicates: true },
      )
    if (error) throw error
  },

  /** Envía el aviso por correo (Resend) a quien corresponda. */
  async notificar(avisoId: string): Promise<{ destinatarios: string[] }> {
    const response = await fetch("/api/avisos/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avisoId }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || "No se pudo enviar la notificación")
    }
    return { destinatarios: payload?.destinatarios ?? [] }
  },
}

/** Nombres de perfil de los usuarios implicados (autores y completadores). */
async function fetchNombres(
  rows: AvisoRowConLecturas[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const ids = Array.from(
    new Set(
      rows.flatMap((row) => [row.creado_por, row.completado_por].filter(Boolean) as string[]),
    ),
  )
  if (ids.length === 0) return {}

  const client = supabase as any
  let query = client.from("perfil").select("usuario_id, nombre_completo").in("usuario_id", ids)
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) {
    // Los nombres son decorativos: si fallan, seguimos con el aviso.
    console.warn("AvisosService: no se pudieron cargar los nombres de perfil", error)
    return {}
  }

  return (data ?? []).reduce((acc: Record<string, string>, perfil: any) => {
    const nombre = perfil?.nombre_completo?.trim()
    if (nombre) acc[perfil.usuario_id] = nombre
    return acc
  }, {})
}

function mapAviso(
  row: AvisoRowConLecturas,
  ctx: ListarAvisosContexto,
  nombres: Record<string, string>,
): Aviso {
  const lecturas = row.lecturas ?? []
  const esMio = row.creado_por === ctx.usuarioId
  const loHeLeido = lecturas.some((l) => l.usuario_id === ctx.usuarioId)

  return {
    ...row,
    tipo: row.tipo as AvisoTipo,
    destinatario: row.destinatario as AvisoDestinatario,
    estado: row.estado as AvisoEstado,
    autorNombre: nombres[row.creado_por] ?? null,
    completadoPorNombre: row.completado_por ? nombres[row.completado_por] ?? null : null,
    esMio,
    esParaMi: row.destinatario === ctx.miLado,
    noLeido: !esMio && !loHeLeido,
    lecturas: lecturas.filter((l) => l.usuario_id !== row.creado_por).length,
  }
}
