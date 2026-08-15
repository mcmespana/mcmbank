"use client"

/**
 * Miniatura real de un PDF: su primera página, rasterizada en el navegador.
 *
 * El comentario que había en `file-thumbnail.tsx` daba esto por imposible, pero
 * lo que se había probado era meter el PDF en un `<iframe>` y encogerlo — eso
 * no es una miniatura, es una foto del visor del navegador, con su barra de
 * herramientas y su fondo gris. Rasterizar la página con pdf.js sí da una
 * imagen del documento y nada más, que es lo que la bandeja necesita para que
 * se reconozca una factura sin abrirla.
 *
 * pdf.js se carga con `import()` dinámico y solo cuando hay un PDF que pintar:
 * son ~350 KB que no tienen por qué viajar con el resto de la aplicación.
 */

let pdfjsPromesa: Promise<typeof import("pdfjs-dist")> | null = null

async function cargarPdfjs() {
  if (!pdfjsPromesa) {
    pdfjsPromesa = (async () => {
      const pdfjs = await import("pdfjs-dist")
      // `new Worker(new URL(...))` es el patrón que entienden tanto Turbopack
      // como webpack: emiten el worker como un asset y reescriben la URL. Nada
      // de copiar el fichero a `public/`, que se queda viejo en cuanto
      // `pdfjs-dist` sube de versión.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      )
      return pdfjs
    })().catch((err) => {
      // Un fallo al cargar no puede dejar la promesa cacheada en rechazo para
      // siempre: el siguiente intento vuelve a probar.
      pdfjsPromesa = null
      throw err
    })
  }
  return pdfjsPromesa
}

/**
 * Devuelve la primera página del PDF como data URL de imagen, o `null` si el
 * documento no se puede leer (cifrado, corrupto, o pdf.js no ha cargado).
 *
 * `anchoObjetivo` es el ancho en píxeles de la imagen resultante; se escoge la
 * escala para llegar a él, con un tope para no rasterizar un A3 a tamaño real.
 */
export async function primeraPaginaComoImagen(
  url: string,
  anchoObjetivo = 400,
): Promise<string | null> {
  try {
    const pdfjs = await cargarPdfjs()
    const tarea = pdfjs.getDocument({ url })
    const documento = await tarea.promise
    try {
      const pagina = await documento.getPage(1)
      const base = pagina.getViewport({ scale: 1 })
      const escala = Math.min(anchoObjetivo / base.width, 4)
      const viewport = pagina.getViewport({ scale: escala })

      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const contexto = canvas.getContext("2d")
      if (!contexto) return null

      // Fondo blanco: un PDF sin fondo propio se rasteriza transparente y en
      // modo oscuro se vería el texto negro sobre negro.
      contexto.fillStyle = "#ffffff"
      contexto.fillRect(0, 0, canvas.width, canvas.height)

      await pagina.render({ canvas, canvasContext: contexto, viewport } as any).promise
      return canvas.toDataURL("image/webp", 0.8)
    } finally {
      // Se cierra la tarea, no solo el documento: así se liberan también las
      // peticiones de red en vuelo si la miniatura se desmonta a medias.
      await tarea.destroy()
    }
  } catch (err) {
    console.warn("No se pudo rasterizar la primera página del PDF:", err)
    return null
  }
}
