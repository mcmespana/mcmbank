/**
 * Descarga y almacenamiento del logo de un proveedor. SOLO SERVIDOR: hace
 * peticiones salientes y escribe en Storage con el service role.
 *
 * La idea de fondo: el logo se descarga UNA vez y se guarda en nuestro bucket
 * `logos`. Nunca se enlaza a un servicio de terceros desde la interfaz. Eso
 * significa que la app no depende de que unavatar o Google sigan existiendo, no
 * pide un favicon externo por cada fila de la lista de movimientos, y —cuando
 * los proveedores sean globales— una sola descarga sirve a las 18 delegaciones.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { dominiosCandidatos, limpiarDominio } from "@/lib/utils/proveedor-logo"

const BUCKET = "logos"

/** Ninguna descarga puede tardar más que esto. */
const TIMEOUT_MS = 8000

/**
 * Por debajo de este tamaño lo que llega no es un logo: es un 1x1, un icono
 * vacío o la página de error de la fuente.
 */
const TAMANO_MINIMO = 400

/** El bucket corta en 1 MB; se comprueba antes para no subir en balde. */
const TAMANO_MAXIMO = 1024 * 1024

/**
 * Las cuatro fuentes que quedan vivas, en orden de acierto medido contra
 * proveedores españoles reales. unavatar acierta en casi todos; las otras tres
 * tapan sus huecos (Lidl, Renfe, Iberdrola no salen en las mismas).
 *
 * Clearbit, que es la que recomienda todo el mundo en internet, está cerrada
 * desde que HubSpot la compró: no responde. No la añadas.
 */
const FUENTES: ReadonlyArray<{ nombre: string; url: (dominio: string) => string }> = [
  { nombre: "unavatar", url: (d) => `https://unavatar.io/${encodeURIComponent(d)}?fallback=false` },
  { nombre: "duckduckgo", url: (d) => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico` },
  { nombre: "google", url: (d) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128` },
  { nombre: "apple-touch-icon", url: (d) => `https://${d}/apple-touch-icon.png` },
]

/** Firmas de archivo de los formatos que aceptamos, con su tipo y extensión. */
const FIRMAS: ReadonlyArray<{ tipo: string; ext: string; test: (b: Uint8Array) => boolean }> = [
  { tipo: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { tipo: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { tipo: "image/x-icon", ext: "ico", test: (b) => b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) },
  {
    tipo: "image/webp",
    ext: "webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
]

/**
 * Nombres de host que no se consultan nunca. `limpiarDominio` ya exige un TLD
 * de letras, lo que descarta las IP en crudo (169.254.169.254 no pasa), pero el
 * dominio lo escribe una persona en un formulario y esta lista cierra el resto
 * de puertas a la red interna.
 */
const HOSTS_PROHIBIDOS = [/(^|\.)localhost$/, /(^|\.)local$/, /(^|\.)internal$/, /(^|\.)localdomain$/]

function hostPermitido(dominio: string): boolean {
  return !HOSTS_PROHIBIDOS.some((patron) => patron.test(dominio))
}

export interface LogoDescargado {
  bytes: Uint8Array
  tipoMime: string
  extension: string
  /** Dominio del que salió, para guardarlo en la ficha. */
  dominio: string
  /** Qué fuente acertó. Solo para el log y la depuración. */
  fuente: string
}

/**
 * Identifica el formato por la firma del archivo, no por lo que diga el
 * `Content-Type`: las fuentes de favicons devuelven páginas de error con
 * cabecera de imagen, y un navegador puede mandar cualquier cosa.
 */
export function identificarImagen(bytes: Uint8Array): { tipo: string; ext: string } | null {
  for (const firma of FIRMAS) {
    if (bytes.length >= 12 && firma.test(bytes)) return { tipo: firma.tipo, ext: firma.ext }
  }
  // Un SVG es texto; se mira el principio en busca de su etiqueta.
  const cabecera = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 256)).trimStart().toLowerCase()
  if (cabecera.startsWith("<svg") || (cabecera.startsWith("<?xml") && cabecera.includes("<svg"))) {
    return { tipo: "image/svg+xml", ext: "svg" }
  }
  return null
}

/**
 * Prueba cada dominio contra cada fuente y devuelve la primera imagen válida.
 * Recorre por dominio y luego por fuente: acertar el dominio bueno importa más
 * que la fuente concreta que lo sirva.
 */
export async function descargarLogo(dominios: string[]): Promise<LogoDescargado | null> {
  for (const dominio of dominios) {
    if (!hostPermitido(dominio)) continue

    for (const fuente of FUENTES) {
      try {
        const respuesta = await fetch(fuente.url(dominio), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "follow",
          headers: {
            // Sin User-Agent de navegador, unos cuantos sitios devuelven 403.
            "User-Agent": "Mozilla/5.0 (compatible; MCMBank/1.0; +https://mcmbank.vercel.app)",
            Accept: "image/*,*/*;q=0.8",
          },
        })

        if (!respuesta.ok) continue

        const buffer = await respuesta.arrayBuffer()
        if (buffer.byteLength < TAMANO_MINIMO || buffer.byteLength > TAMANO_MAXIMO) continue

        const bytes = new Uint8Array(buffer)
        const identificado = identificarImagen(bytes)
        // Sin firma válida es un HTML de error disfrazado de imagen.
        if (!identificado) continue

        return {
          bytes,
          tipoMime: identificado.tipo,
          extension: identificado.ext,
          dominio,
          fuente: fuente.nombre,
        }
      } catch {
        // Timeout, DNS que no resuelve, TLS roto: se prueba la siguiente.
        continue
      }
    }
  }

  return null
}

export interface LogoGuardado {
  logoUrl: string
  dominio: string
  fuente: string
}

/**
 * Sube el logo al bucket y devuelve su URL pública. El nombre del archivo lleva
 * la marca de tiempo para que al reemplazar un logo el navegador no siga
 * enseñando el viejo desde su caché.
 */
export async function subirLogo(
  contactoId: string,
  logo: Pick<LogoDescargado, "bytes" | "tipoMime" | "extension">,
): Promise<string> {
  const admin = createAdminClient() as any
  const path = `proveedores/${contactoId}-${Date.now()}.${logo.extension}`

  const { error } = await admin.storage.from(BUCKET).upload(path, logo.bytes, {
    contentType: logo.tipoMime,
    upsert: true,
    cacheControl: "31536000",
  })
  if (error) throw new Error(`No se pudo guardar el logo: ${error.message}`)

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl as string
}

/**
 * Borra del bucket un logo que se guardó con `subirLogo`. Los fallos solo se
 * registran: quedarse un archivo huérfano de 15 KB es mucho menos grave que
 * dejar la ficha apuntando a un logo que ya no debería estar.
 */
export async function borrarLogoDeStorage(logoUrl: string | null | undefined): Promise<void> {
  const path = pathDesdeUrlPublica(logoUrl)
  if (!path) return

  const admin = createAdminClient() as any
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) console.error("No se pudo borrar el logo anterior del bucket:", error.message)
}

/** Saca el path dentro del bucket de una URL pública de Storage. */
export function pathDesdeUrlPublica(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null
  const marca = `/storage/v1/object/public/${BUCKET}/`
  const indice = logoUrl.indexOf(marca)
  if (indice === -1) return null
  const path = logoUrl.slice(indice + marca.length).split("?")[0]
  return path ? decodeURIComponent(path) : null
}

/**
 * Guarda un logo subido por una persona. Queda marcado como `manual`, y eso lo
 * blinda: la búsqueda automática no vuelve a tocarlo. Si alguien se ha tomado
 * la molestia de subir el logo bueno, ningún favicon se lo pisa.
 */
export async function guardarLogoManual(contactoId: string, bytes: Uint8Array): Promise<LogoGuardado> {
  if (bytes.byteLength > TAMANO_MAXIMO) {
    throw new Error("El logo no puede pasar de 1 MB")
  }

  const identificado = identificarImagen(bytes)
  if (!identificado) {
    throw new Error("El archivo no es una imagen (se admite PNG, JPG, SVG, WEBP, GIF o ICO)")
  }

  const admin = createAdminClient() as any
  const { data: contacto } = await admin.from("contacto").select("logo_url").eq("id", contactoId).maybeSingle()

  const logoUrl = await subirLogo(contactoId, {
    bytes,
    tipoMime: identificado.tipo,
    extension: identificado.ext,
  })

  const { error } = await admin
    .from("contacto")
    .update({ logo_url: logoUrl, logo_fuente: "manual", logo_actualizado_en: new Date().toISOString() })
    .eq("id", contactoId)

  if (error) throw new Error(`No se pudo guardar el logo en la ficha: ${error.message}`)

  if (contacto?.logo_url && contacto.logo_url !== logoUrl) await borrarLogoDeStorage(contacto.logo_url)

  return { logoUrl, dominio: "", fuente: "manual" }
}

export interface ResultadoResolucion {
  encontrado: boolean
  logoUrl: string | null
  dominio: string | null
  fuente: string | null
  /** Dominios que se intentaron, para poder explicar por qué no se encontró. */
  intentados: string[]
}

/**
 * Busca y guarda el logo de un contacto: adivina sus dominios, descarga el
 * primero que responda con una imagen y actualiza la ficha.
 *
 * Un logo `manual` no se toca salvo que se pida `forzar`: si alguien se ha
 * molestado en subir el bueno, un favicon automático no se lo pisa.
 */
export async function resolverLogoProveedor(
  contactoId: string,
  opciones: { dominio?: string | null; forzar?: boolean; especular?: boolean } = {},
): Promise<ResultadoResolucion> {
  const admin = createAdminClient() as any

  const { data: contacto, error } = await admin
    .from("contacto")
    .select("id, nombre, dominio, logo_url, logo_fuente")
    .eq("id", contactoId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el contacto: ${error.message}`)
  if (!contacto) throw new Error("Contacto no encontrado")

  if (contacto.logo_fuente === "manual" && !opciones.forzar) {
    return {
      encontrado: true,
      logoUrl: contacto.logo_url ?? null,
      dominio: contacto.dominio ?? null,
      fuente: "manual",
      intentados: [],
    }
  }

  const dominioPedido = limpiarDominio(opciones.dominio) ?? contacto.dominio
  const candidatos = dominiosCandidatos(contacto.nombre, dominioPedido, {
    especular: opciones.especular === true,
  }).filter(hostPermitido)

  const logo = await descargarLogo(candidatos)
  if (!logo) {
    return { encontrado: false, logoUrl: null, dominio: dominioPedido ?? null, fuente: null, intentados: candidatos }
  }

  const logoUrl = await subirLogo(contactoId, logo)
  const anterior = contacto.logo_url

  const { error: errorUpdate } = await admin
    .from("contacto")
    .update({
      logo_url: logoUrl,
      logo_fuente: "auto",
      logo_actualizado_en: new Date().toISOString(),
      dominio: logo.dominio,
    })
    .eq("id", contactoId)

  if (errorUpdate) throw new Error(`No se pudo guardar el logo en la ficha: ${errorUpdate.message}`)

  // Solo se borra el anterior cuando la ficha ya apunta al nuevo.
  if (anterior && anterior !== logoUrl) await borrarLogoDeStorage(anterior)

  return { encontrado: true, logoUrl, dominio: logo.dominio, fuente: logo.fuente, intentados: candidatos }
}
