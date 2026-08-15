export type BucketArchivo = "facturas" | "documentos"

/**
 * Los archivos viven en buckets privados, así que **cualquier** cosa que los
 * pinte (una miniatura, el visor de PDF, un enlace de descarga) necesita pasar
 * antes por `/api/files/signed-url`. `archivo_adjunto.url_publica` existe por
 * historia pero no sirve para nada de eso: apunta al bucket sin firma y el
 * navegador se come un 400, que es lo que dejaba las miniaturas de imagen rotas
 * y convertía "Abrir en pestaña nueva" en un viaje a ninguna parte.
 *
 * La firma dura 300 s en el servidor. Aquí se cachean 4 minutos y se comparten
 * las peticiones en vuelo: una bandeja con veinte facturas pinta veinte
 * miniaturas a la vez y no tiene sentido pedir veinte firmas de la misma
 * URL cada vez que React vuelve a montar la tarjeta.
 */
const TTL_MS = 4 * 60 * 1000

interface EntradaCache {
  url: string
  expiraEn: number
}

const cache = new Map<string, EntradaCache>()
const enVuelo = new Map<string, Promise<string>>()

function clave(path: string, bucket: BucketArchivo): string {
  return `${bucket}:${path}`
}

export async function getSignedFileUrl(pathStorage: string, bucket: BucketArchivo): Promise<string> {
  const k = clave(pathStorage, bucket)

  const cacheada = cache.get(k)
  if (cacheada && cacheada.expiraEn > Date.now()) return cacheada.url

  const yaPedida = enVuelo.get(k)
  if (yaPedida) return yaPedida

  const peticion = (async () => {
    const res = await fetch("/api/files/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathStorage, bucket }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || "No se pudo generar el enlace del archivo")
    }

    const { url } = await res.json()
    cache.set(k, { url: url as string, expiraEn: Date.now() + TTL_MS })
    return url as string
  })()

  enVuelo.set(k, peticion)
  try {
    return await peticion
  } finally {
    enVuelo.delete(k)
  }
}

/** Olvida la firma de un archivo (tras sustituirlo o borrarlo). */
export function olvidarUrlFirmada(pathStorage: string, bucket: BucketArchivo): void {
  cache.delete(clave(pathStorage, bucket))
}

/**
 * Descarga de verdad: el archivo acaba en la carpeta de descargas.
 *
 * Un `<a download>` apuntando a la URL firmada no descarga —es otro origen
 * (Supabase Storage), y ahí el atributo `download` se ignora y el navegador
 * abre el PDF en una pestaña—, así que se baja el contenido a un blob del
 * mismo origen y se descarga desde ahí.
 */
export async function descargarArchivo(
  pathStorage: string,
  bucket: BucketArchivo,
  nombre: string,
): Promise<void> {
  const url = await getSignedFileUrl(pathStorage, bucket)
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error("No se pudo descargar el archivo")

  const blob = await respuesta.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const enlace = document.createElement("a")
    enlace.href = objectUrl
    enlace.download = nombre
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } finally {
    // Tiempo de sobra para que el navegador arranque la descarga.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  }
}
