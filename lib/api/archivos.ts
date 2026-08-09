import type { createAdminClient } from "@/lib/supabase/admin"
import { ApiError, badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { serializeArchivo, type ArchivoPublico } from "@/lib/api/movimientos-public"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Subida y descarga de archivos (facturas y documentos) desde la API externa.
 *
 * Replica exactamente lo que hace la app en el navegador
 * (`lib/services/file-service.ts` + `hooks/use-movimiento-archivos.ts`): mismo
 * bucket, misma estructura de carpetas y mismos registros en base de datos, de
 * modo que un archivo subido por la API se ve igual que uno subido a mano.
 */

export type BucketArchivo = "facturas" | "documentos"

export const BUCKETS: readonly BucketArchivo[] = ["facturas", "documentos"] as const

const MIME_PERMITIDOS: Record<BucketArchivo, string[]> = {
  facturas: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ],
  documentos: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/x-rar-compressed",
    "video/mp4",
    "audio/mpeg",
    "audio/wav",
  ],
}

/**
 * Tope de tamaño para subidas por API. La app permite 20 MB, pero una función
 * serverless de Vercel rechaza cuerpos de petición de más de ~4,5 MB, y en
 * base64 un archivo ocupa un 33 % más. 3 MB de archivo real caben con margen;
 * por encima de eso, hay que subirlo desde la app.
 */
export const MAX_BYTES_API = 3 * 1024 * 1024

const EXTENSION_A_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function mimeDesdeNombre(nombre: string): string | null {
  const ext = nombre.split(".").pop()?.toLowerCase()
  return (ext && EXTENSION_A_MIME[ext]) || null
}

function limpiarNombre(nombre: string): string {
  const limpio = nombre.replace(/[^a-zA-Z0-9.-]/g, "_")
  return limpio || "archivo"
}

/** Decodifica el contenido base64 (admite data URLs `data:...;base64,XXXX`). */
function decodificarBase64(contenido: string): Buffer {
  const limpio = contenido.includes(",") && contenido.trimStart().startsWith("data:")
    ? contenido.slice(contenido.indexOf(",") + 1)
    : contenido
  const buffer = Buffer.from(limpio.replace(/\s+/g, ""), "base64")
  if (buffer.length === 0) {
    throw badRequest("El contenido en base64 está vacío o no es base64 válido.")
  }
  return buffer
}

export interface ArchivoEntrante {
  /** Nombre con extensión, tal y como debe verse en la app. */
  nombre: string
  /** Contenido del fichero codificado en base64 (admite data URL). */
  contenido_base64: string
  /** Si no se indica, se deduce de la extensión del nombre. */
  tipo_mime?: string | null
  descripcion?: string | null
  /** `facturas` (por defecto) o `documentos`. */
  bucket?: BucketArchivo | null
}

interface ArchivoValidado {
  nombreOriginal: string
  nombreLimpio: string
  bucket: BucketArchivo
  mime: string
  buffer: Buffer
  descripcion: string | null
}

function validarArchivo(entrada: ArchivoEntrante): ArchivoValidado {
  const nombreOriginal = (entrada.nombre ?? "").trim()
  if (!nombreOriginal) throw badRequest("Falta el nombre del archivo (con su extensión).")

  const bucket = (entrada.bucket ?? "facturas") as BucketArchivo
  if (!BUCKETS.includes(bucket)) {
    throw badRequest(`Bucket '${bucket}' no válido. Usa 'facturas' o 'documentos'.`)
  }

  const mime = (entrada.tipo_mime?.trim() || mimeDesdeNombre(nombreOriginal) || "").toLowerCase()
  if (!mime) {
    throw badRequest(
      `No sé qué tipo de archivo es '${nombreOriginal}'. Añade la extensión al nombre o indica 'tipo_mime'.`,
    )
  }
  if (!MIME_PERMITIDOS[bucket].includes(mime)) {
    throw badRequest(`Tipo de archivo no permitido en '${bucket}': ${mime}.`, {
      permitidos: MIME_PERMITIDOS[bucket],
    })
  }

  const buffer = decodificarBase64(entrada.contenido_base64 ?? "")
  if (buffer.length > MAX_BYTES_API) {
    throw badRequest(
      `El archivo ocupa ${(buffer.length / 1024 / 1024).toFixed(1)} MB y por API el máximo son ${(
        MAX_BYTES_API /
        1024 /
        1024
      ).toFixed(0)} MB. Súbelo desde la aplicación (allí el límite es 20 MB).`,
    )
  }

  return {
    nombreOriginal,
    nombreLimpio: limpiarNombre(nombreOriginal),
    bucket,
    mime,
    buffer,
    descripcion: entrada.descripcion?.trim() || null,
  }
}

/**
 * Sube el fichero a Storage con la misma estructura de carpetas que la app:
 * `<delegacion>/<año>/<mes>/<scope>/<id>/<archivo>`. Si ya existe un fichero
 * con ese nombre, añade un sufijo en vez de sobrescribir (el original puede ser
 * la factura buena de otro adjunto).
 */
async function subirAStorage(
  admin: AdminClient,
  archivo: ArchivoValidado,
  carpeta: string,
): Promise<string> {
  const base = archivo.nombreLimpio
  const punto = base.lastIndexOf(".")
  const raiz = punto > 0 ? base.slice(0, punto) : base
  const extension = punto > 0 ? base.slice(punto) : ""

  for (let intento = 0; intento < 5; intento += 1) {
    const nombre = intento === 0 ? base : `${raiz}-${intento + 1}${extension}`
    const path = `${carpeta}/${nombre}`
    const { data, error } = await admin.storage
      .from(archivo.bucket)
      .upload(path, archivo.buffer, { contentType: archivo.mime, cacheControl: "3600", upsert: false })

    if (!error && data) return data.path

    const mensaje = String((error as any)?.message ?? "")
    const yaExiste = /exists|duplicate/i.test(mensaje)
    if (!yaExiste) {
      throw new ApiError(502, `No se pudo subir el archivo a Storage: ${mensaje || "error desconocido"}`)
    }
  }

  throw new ApiError(
    409,
    `Ya hay varios archivos llamados '${archivo.nombreOriginal}' en esa carpeta. Cambia el nombre.`,
  )
}

function carpetaFecha(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}/${MESES[ahora.getMonth()]}`
}

export interface ResultadoSubida {
  archivo: ArchivoPublico
  /** Factura creada o reutilizada cuando el adjunto es una factura. */
  factura_id?: string | null
  aviso?: string
}

/**
 * Adjunta un archivo a un movimiento.
 *
 * Si el bucket es `facturas`, replica el comportamiento de la app: además del
 * adjunto crea (o reutiliza) la entidad `factura` al otro lado, ya conciliada
 * con este movimiento y con sus datos. Es lo que hace que "sube esta factura y
 * vincúlala al movimiento X" sea una sola operación.
 */
export async function subirArchivoAMovimiento(
  admin: AdminClient,
  params: {
    movimientoId: string
    archivo: ArchivoEntrante
    /** Crear también la entidad factura (por defecto sí, si el bucket es `facturas`). */
    crearFactura?: boolean
    actorId: string
    baseUrl?: string
  },
): Promise<ResultadoSubida> {
  const validado = validarArchivo(params.archivo)

  const movimiento = unwrap(
    await (admin as any)
      .from("movimiento")
      .select("id, delegacion_id, fecha, concepto, importe, contacto_id, factura_id")
      .eq("id", params.movimientoId)
      .maybeSingle(),
  ) as any
  if (!movimiento) {
    throw notFound(`No existe ningún movimiento con el id ${params.movimientoId}.`)
  }
  if (!movimiento.delegacion_id) {
    throw badRequest("Ese movimiento no tiene delegación asignada, así que no sé dónde guardar el archivo.")
  }

  const codigo = await codigoDelegacion(admin, movimiento.delegacion_id)
  const path = await subirAStorage(
    admin,
    validado,
    `${codigo}/${carpetaFecha()}/${params.movimientoId}`,
  )

  const fila = unwrap(
    await (admin as any)
      .from("movimiento_archivo")
      .upsert(
        [
          {
            movimiento_id: params.movimientoId,
            nombre_original: validado.nombreOriginal,
            nombre_archivo: path.split("/").pop() || validado.nombreLimpio,
            tipo_mime: validado.mime,
            "tamaño_bytes": validado.buffer.length,
            bucket: validado.bucket,
            path_storage: path,
            url_publica: "",
            es_factura: validado.bucket === "facturas",
            descripcion: validado.descripcion,
            subido_por: params.actorId,
          },
        ],
        { onConflict: "movimiento_id,path_storage" },
      )
      .select()
      .single(),
  ) as any

  const resultado: ResultadoSubida = {
    archivo: serializeArchivo(fila, { baseUrl: params.baseUrl }),
    factura_id: movimiento.factura_id ?? null,
  }

  const debeCrearFactura =
    validado.bucket === "facturas" && params.crearFactura !== false
  if (debeCrearFactura) {
    try {
      const factura = await asegurarFacturaDeMovimiento(admin, params.movimientoId, params.actorId)
      await registrarArchivoEnFactura(admin, factura.id, movimiento.delegacion_id, {
        nombre_original: validado.nombreOriginal,
        nombre_archivo: fila.nombre_archivo,
        tipo_mime: validado.mime,
        tamano_bytes: validado.buffer.length,
        bucket: validado.bucket,
        path_storage: path,
        url_publica: "",
        descripcion: validado.descripcion,
        subido_por: params.actorId,
      })
      resultado.factura_id = factura.id
    } catch (err) {
      // El adjunto ya está guardado: no se tira la subida porque falle el
      // registro en la sección Facturas, pero sí se avisa.
      resultado.aviso = `El archivo se subió, pero no se pudo registrar en la sección Facturas: ${
        err instanceof Error ? err.message : String(err)
      }`
    }
  }

  return resultado
}

/** Adjunta un archivo a una factura de la bandeja (entidad `factura`). */
export async function subirArchivoAFactura(
  admin: AdminClient,
  params: { facturaId: string; archivo: ArchivoEntrante; actorId: string; baseUrl?: string },
): Promise<ResultadoSubida> {
  const validado = validarArchivo(params.archivo)

  const factura = unwrap(
    await (admin as any)
      .from("factura")
      .select("id, delegacion_id")
      .eq("id", params.facturaId)
      .maybeSingle(),
  ) as any
  if (!factura) throw notFound(`No existe ninguna factura con el id ${params.facturaId}.`)

  const codigo = await codigoDelegacion(admin, factura.delegacion_id)
  const path = await subirAStorage(
    admin,
    validado,
    `${codigo}/${carpetaFecha()}/factura/${params.facturaId}`,
  )

  const fila = unwrap(
    await (admin as any)
      .from("archivo_adjunto")
      .upsert(
        [
          {
            entidad: "factura",
            entidad_id: params.facturaId,
            delegacion_id: factura.delegacion_id,
            nombre_original: validado.nombreOriginal,
            nombre_archivo: path.split("/").pop() || validado.nombreLimpio,
            tipo_mime: validado.mime,
            tamano_bytes: validado.buffer.length,
            bucket: validado.bucket,
            path_storage: path,
            url_publica: "",
            es_factura: true,
            descripcion: validado.descripcion,
            subido_por: params.actorId,
          },
        ],
        { onConflict: "entidad,entidad_id,path_storage" },
      )
      .select()
      .single(),
  ) as any

  // Si la factura ya está conciliada con movimientos, el adjunto nuevo se
  // replica en ellos para que se vea desde ambos lados.
  const movimientos = (unwrap(
    await (admin as any).from("movimiento").select("id").eq("factura_id", params.facturaId),
  ) ?? []) as { id: string }[]
  for (const mov of movimientos) {
    await replicarArchivoEnMovimiento(admin, mov.id, fila, params.actorId).catch(() => undefined)
  }

  return { archivo: serializeArchivo(fila, { baseUrl: params.baseUrl }), factura_id: params.facturaId }
}

/** Archivos de una factura (tabla `archivo_adjunto`). */
export async function listarArchivosFactura(
  admin: AdminClient,
  facturaId: string,
  options: { baseUrl?: string } = {},
): Promise<ArchivoPublico[]> {
  const filas = (unwrap(
    await (admin as any)
      .from("archivo_adjunto")
      .select("*")
      .eq("entidad", "factura")
      .eq("entidad_id", facturaId)
      .order("subido_en", { ascending: true }),
  ) ?? []) as any[]
  return filas.map((f) => serializeArchivo(f, { baseUrl: options.baseUrl }))
}

/** Archivos de varias facturas a la vez, agrupados por factura. */
export async function archivosDeFacturas(
  admin: AdminClient,
  facturaIds: string[],
  options: { baseUrl?: string } = {},
): Promise<Map<string, ArchivoPublico[]>> {
  const agrupados = new Map<string, ArchivoPublico[]>()
  if (facturaIds.length === 0) return agrupados

  const filas = (unwrap(
    await (admin as any)
      .from("archivo_adjunto")
      .select("*")
      .eq("entidad", "factura")
      .in("entidad_id", facturaIds)
      .order("subido_en", { ascending: true }),
  ) ?? []) as any[]

  for (const fila of filas) {
    const lista = agrupados.get(fila.entidad_id) ?? []
    lista.push(serializeArchivo(fila, { baseUrl: options.baseUrl }))
    agrupados.set(fila.entidad_id, lista)
  }
  return agrupados
}

/** Copia un adjunto de factura en `movimiento_archivo` (mismo path de Storage). */
export async function replicarArchivoEnMovimiento(
  admin: AdminClient,
  movimientoId: string,
  adjunto: any,
  actorId: string,
): Promise<void> {
  const { error } = await (admin as any).from("movimiento_archivo").upsert(
    [
      {
        movimiento_id: movimientoId,
        nombre_original: adjunto.nombre_original,
        nombre_archivo: adjunto.nombre_archivo,
        tipo_mime: adjunto.tipo_mime,
        "tamaño_bytes": adjunto.tamano_bytes ?? adjunto["tamaño_bytes"] ?? 0,
        bucket: adjunto.bucket,
        path_storage: adjunto.path_storage,
        url_publica: adjunto.url_publica ?? "",
        es_factura: true,
        descripcion: adjunto.descripcion ?? null,
        subido_por: adjunto.subido_por ?? actorId,
      },
    ],
    { onConflict: "movimiento_id,path_storage", ignoreDuplicates: true },
  )
  if (error) throw wrapSupabaseError(error)
}

/** Registra en `archivo_adjunto` un archivo ya subido a Storage. Idempotente. */
export async function registrarArchivoEnFactura(
  admin: AdminClient,
  facturaId: string,
  delegacionId: string,
  archivo: {
    nombre_original: string
    nombre_archivo: string
    tipo_mime: string
    tamano_bytes: number
    bucket: string
    path_storage: string
    url_publica: string
    descripcion?: string | null
    subido_por: string
  },
): Promise<void> {
  const { error } = await (admin as any).from("archivo_adjunto").upsert(
    [
      {
        entidad: "factura",
        entidad_id: facturaId,
        delegacion_id: delegacionId,
        ...archivo,
        descripcion: archivo.descripcion ?? null,
        es_factura: true,
      },
    ],
    { onConflict: "entidad,entidad_id,path_storage", ignoreDuplicates: true },
  )
  if (error) throw wrapSupabaseError(error)
}

/**
 * Crea (si no existe) la entidad `factura` de un movimiento al que se le acaba
 * de subir una factura, copiando fecha, importe y contacto. Equivalente
 * servidor de `DatabaseService.ensureFacturaForMovimiento`.
 */
export async function asegurarFacturaDeMovimiento(
  admin: AdminClient,
  movimientoId: string,
  actorId: string,
): Promise<{ id: string }> {
  const movimiento = unwrap(
    await (admin as any)
      .from("movimiento")
      .select("id, delegacion_id, fecha, concepto, importe, contacto_id, factura_id")
      .eq("id", movimientoId)
      .maybeSingle(),
  ) as any
  if (!movimiento) throw notFound(`No existe ningún movimiento con el id ${movimientoId}.`)

  if (movimiento.factura_id) {
    const existente = unwrap(
      await (admin as any).from("factura").select("id").eq("id", movimiento.factura_id).maybeSingle(),
    ) as any
    if (existente) return existente
  }
  if (!movimiento.delegacion_id) throw badRequest("El movimiento no tiene delegación.")

  const creada = unwrap(
    await (admin as any)
      .from("factura")
      .insert({
        delegacion_id: movimiento.delegacion_id,
        contacto_id: movimiento.contacto_id,
        concepto: movimiento.concepto,
        fecha_emision: movimiento.fecha,
        importe: Math.abs(Number(movimiento.importe)) || null,
        origen: "movimiento",
        creado_por: actorId,
      })
      .select("id")
      .single(),
  ) as any

  const { error } = await (admin as any)
    .from("movimiento")
    .update({ factura_id: creada.id })
    .eq("id", movimientoId)
  if (error) {
    await (admin as any).from("factura").delete().eq("id", creada.id)
    throw wrapSupabaseError(error)
  }

  return creada
}

/** Código de la delegación (o su id, si no tiene código) para la ruta de Storage. */
async function codigoDelegacion(admin: AdminClient, delegacionId: string): Promise<string> {
  const delegacion = unwrap(
    await (admin as any).from("delegacion").select("codigo, id").eq("id", delegacionId).maybeSingle(),
  ) as any
  const codigo = delegacion?.codigo?.trim()
  return limpiarNombre(codigo || delegacionId)
}

// ---------------------------------------------------------------------------
// Descarga
// ---------------------------------------------------------------------------

export interface ArchivoLocalizado {
  fila: any
  origen: "movimiento" | "factura"
}

/** Busca un archivo por id en las dos tablas de adjuntos. */
export async function localizarArchivo(
  admin: AdminClient,
  archivoId: string,
): Promise<ArchivoLocalizado> {
  const [movimientoArchivo, adjunto] = await Promise.all([
    (admin as any).from("movimiento_archivo").select("*").eq("id", archivoId).maybeSingle(),
    (admin as any).from("archivo_adjunto").select("*").eq("id", archivoId).maybeSingle(),
  ])

  if (movimientoArchivo.data) return { fila: movimientoArchivo.data, origen: "movimiento" }
  if (adjunto.data) return { fila: adjunto.data, origen: "factura" }
  throw notFound(`No existe ningún archivo con el id ${archivoId}.`)
}

/**
 * URL firmada de descarga. Los buckets `facturas` y `documentos` son públicos
 * hoy, pero se firma igualmente: es lo que hace la app y lo correcto el día que
 * dejen de serlo.
 */
export async function urlFirmada(
  admin: AdminClient,
  bucket: string,
  path: string,
  segundos = 300,
): Promise<string> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, segundos)
  if (error || !data?.signedUrl) {
    throw new ApiError(502, `No se pudo generar la URL de descarga: ${error?.message ?? "error desconocido"}`)
  }
  return data.signedUrl
}

/** Borra un archivo de Storage y su registro. */
export async function eliminarArchivo(admin: AdminClient, archivoId: string): Promise<void> {
  const { fila, origen } = await localizarArchivo(admin, archivoId)

  const { error: storageError } = await admin.storage.from(fila.bucket).remove([fila.path_storage])
  if (storageError) {
    // El fichero puede haber desaparecido ya de Storage; el registro sí se limpia.
    console.warn("No se pudo borrar el fichero de Storage:", storageError.message)
  }

  const tabla = origen === "movimiento" ? "movimiento_archivo" : "archivo_adjunto"
  const { error } = await (admin as any).from(tabla).delete().eq("id", archivoId)
  if (error) throw wrapSupabaseError(error)
}
