import type { Database } from "./database"

/**
 * Avisos y tareas: apuntes cortos entre la oficina técnica (gestores centrales)
 * y los tesoreros de cada delegación. Siempre viven dentro de una delegación.
 */
export type AvisoRow = Database["public"]["Tables"]["aviso"]["Row"]
export type AvisoInsert = Database["public"]["Tables"]["aviso"]["Insert"]
export type AvisoUpdate = Database["public"]["Tables"]["aviso"]["Update"]
export type AvisoLectura = Database["public"]["Tables"]["aviso_lectura"]["Row"]

// tipo, destinatario y estado son text en la BD; la app los restringe aquí.
export type AvisoTipo = "tarea" | "nota"
export type AvisoDestinatario = "oficina_tecnica" | "delegacion"
export type AvisoEstado = "pendiente" | "hecha"

export const AVISO_TIPOS: readonly AvisoTipo[] = ["tarea", "nota"] as const
export const AVISO_DESTINATARIOS: readonly AvisoDestinatario[] = ["oficina_tecnica", "delegacion"] as const

export const AVISO_MAX_CONTENIDO = 2000
export const AVISO_MAX_REFERENCIA = 60

/** Aviso tal y como lo consume la UI: tipos afinados + autoría y lectura resueltas. */
export type Aviso = Omit<AvisoRow, "tipo" | "destinatario" | "estado"> & {
  tipo: AvisoTipo
  destinatario: AvisoDestinatario
  estado: AvisoEstado
  /** Nombre del autor (perfil.nombre_completo) o null si no tiene perfil. */
  autorNombre: string | null
  /** Nombre de quien la marcó como hecha. */
  completadoPorNombre: string | null
  /** true si soy el autor. */
  esMio: boolean
  /** true si va dirigido a mi lado (oficina técnica o delegación). */
  esParaMi: boolean
  /** true si todavía no lo he marcado como leído (y no lo escribí yo). */
  noLeido: boolean
  /** Cuántas personas lo han leído (sin contar al autor). */
  lecturas: number
}

export const AVISO_TIPO_LABELS: Record<AvisoTipo, string> = {
  tarea: "Tarea",
  nota: "Nota",
}

export const AVISO_DESTINATARIO_LABELS: Record<AvisoDestinatario, string> = {
  oficina_tecnica: "Oficina técnica",
  delegacion: "Delegación",
}

/** Etiqueta corta para el selector del compositor ("Para: …"). */
export const AVISO_DESTINATARIO_SHORT: Record<AvisoDestinatario, string> = {
  oficina_tecnica: "Oficina técnica",
  delegacion: "Delegación",
}

export interface AvisoContadores {
  /** Notas o tareas nuevas que no he leído. */
  noLeidos: number
  /** Tareas pendientes dirigidas a mí. */
  pendientes: number
}

export interface NuevoAviso {
  tipo: AvisoTipo
  contenido: string
  referencia?: string | null
  destinatario: AvisoDestinatario
  /** Enviar además un correo con Resend a quien corresponda. */
  notificar?: boolean
}
