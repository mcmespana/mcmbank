/**
 * Lógica de datos y serialización para la API externa de movimientos.
 *
 * Se separa de las rutas para que tanto el endpoint combinado
 * (`/api/v1/movimientos/[id]`) como el de archivos
 * (`/api/v1/movimientos/[id]/archivos`) compartan exactamente el mismo formato
 * de salida.
 *
 * El acceso se hace con el cliente admin (service role), de modo que la consulta
 * por ID es global y no depende de la delegación seleccionada ni de RLS: un ID
 * de movimiento es único en toda la base de datos.
 */
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

/** Forma pública de un archivo adjunto. */
export interface ArchivoPublico {
  id: string
  nombre_original: string
  tipo_mime: string
  tamano_bytes: number
  es_factura: boolean
  descripcion: string | null
  bucket: string
  url: string
  subido_en: string
}

/** Forma pública de un movimiento (sin campos internos sensibles). */
export interface MovimientoPublico {
  id: string
  fecha: string
  concepto: string
  descripcion: string | null
  contraparte: string | null
  importe: number
  tipo: "ingreso" | "gasto"
  metodo: string | null
  notas: string | null
  ignorado: boolean
  booking_date: string | null
  value_date: string | null
  origen_sync: string | null
  creado_en: string
  cuenta: {
    id: string
    nombre: string
    tipo: string | null
    banco_nombre: string | null
    iban: string | null
  } | null
  categoria: {
    id: string
    nombre: string
    tipo: string | null
    emoji: string | null
    color: string | null
  } | null
  delegacion: {
    id: string
    codigo: string | null
    nombre: string
  } | null
  contacto: {
    id: string
    nombre: string
    tipo: string | null
  } | null
  archivos: ArchivoPublico[]
}

const MOVIMIENTO_SELECT = `
  id,
  fecha,
  concepto,
  descripcion,
  contraparte,
  importe,
  metodo,
  notas,
  ignorado,
  booking_date,
  value_date,
  origen_sync,
  creado_en,
  cuenta:cuenta_id (
    id,
    nombre,
    tipo,
    banco_nombre,
    iban
  ),
  categoria:categoria_id (
    id,
    nombre,
    tipo,
    emoji,
    color
  ),
  delegacion:delegacion_id (
    id,
    codigo,
    nombre
  ),
  contacto:contacto_id (
    id,
    nombre,
    tipo
  )
`

/**
 * Obtiene un movimiento por su ID con sus relaciones (cuenta, categoría,
 * delegación, contacto). Devuelve `null` si no existe.
 */
export async function getMovimientoRaw(admin: AdminClient, id: string) {
  const { data, error } = await (admin as any)
    .from("movimiento")
    .select(MOVIMIENTO_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Obtiene los archivos adjuntos de un movimiento, ordenados por fecha de subida.
 */
export async function getArchivosRaw(admin: AdminClient, movimientoId: string) {
  const { data, error } = await (admin as any)
    .from("movimiento_archivo")
    .select("*")
    .eq("movimiento_id", movimientoId)
    .order("subido_en", { ascending: true })

  if (error) throw error
  return (data ?? []) as any[]
}

/** Serializa una fila de `movimiento_archivo` al formato público. */
export function serializeArchivo(row: any): ArchivoPublico {
  return {
    id: row.id,
    nombre_original: row.nombre_original,
    tipo_mime: row.tipo_mime,
    // La columna en BD es `tamaño_bytes` (con ñ); se expone sin ñ para clientes.
    tamano_bytes: row["tamaño_bytes"] ?? row.tamano_bytes ?? 0,
    es_factura: !!row.es_factura,
    descripcion: row.descripcion ?? null,
    bucket: row.bucket,
    url: row.url_publica,
    subido_en: row.subido_en,
  }
}

/** Serializa un movimiento (con relaciones ya embebidas) al formato público. */
export function serializeMovimiento(
  row: any,
  archivos: ArchivoPublico[],
): MovimientoPublico {
  return {
    id: row.id,
    fecha: row.fecha,
    concepto: row.concepto,
    descripcion: row.descripcion ?? null,
    contraparte: row.contraparte ?? null,
    importe: row.importe,
    tipo: Number(row.importe) >= 0 ? "ingreso" : "gasto",
    metodo: row.metodo ?? null,
    notas: row.notas ?? null,
    ignorado: !!row.ignorado,
    booking_date: row.booking_date ?? null,
    value_date: row.value_date ?? null,
    origen_sync: row.origen_sync ?? null,
    creado_en: row.creado_en,
    cuenta: row.cuenta
      ? {
          id: row.cuenta.id,
          nombre: row.cuenta.nombre,
          tipo: row.cuenta.tipo ?? null,
          banco_nombre: row.cuenta.banco_nombre ?? null,
          iban: row.cuenta.iban ?? null,
        }
      : null,
    categoria: row.categoria
      ? {
          id: row.categoria.id,
          nombre: row.categoria.nombre,
          tipo: row.categoria.tipo ?? null,
          emoji: row.categoria.emoji ?? null,
          color: row.categoria.color ?? null,
        }
      : null,
    delegacion: row.delegacion
      ? {
          id: row.delegacion.id,
          codigo: row.delegacion.codigo ?? null,
          nombre: row.delegacion.nombre,
        }
      : null,
    contacto: row.contacto
      ? {
          id: row.contacto.id,
          nombre: row.contacto.nombre,
          tipo: row.contacto.tipo ?? null,
        }
      : null,
    archivos,
  }
}
