/*
 * Service worker de MCM Bank — deliberadamente corto.
 *
 * Existe por dos motivos, y ninguno es "funcionar sin conexión":
 *   1. Chrome no ofrece instalar la app si no hay un service worker con manejador
 *      de `fetch`. Sin él, el manifest no sirve de nada en Android.
 *   2. Abrir la app sin cobertura enseñaba el dinosaurio del navegador, que
 *      dentro de una ventana sin barra de direcciones parece que la app está rota.
 *
 * Lo que NO hace, a propósito: **no cachea ni una sola respuesta de datos**.
 * Esto es una aplicación de tesorería; un saldo de hace dos horas servido como
 * si fuera de ahora es peor que un error de red, porque nadie lo nota. Todo lo
 * que vaya a Supabase, a /api o a cualquier otro origen pasa de largo sin
 * tocarse.
 *
 * Solo se guardan dos cosas: la página de "sin conexión" y los ficheros de
 * /_next/static/, que llevan hash en el nombre y por tanto no pueden quedarse
 * obsoletos: si el contenido cambia, cambia la URL.
 */

const VERSION = "v1"
const CACHE = `mcmbank-${VERSION}`
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Nada que no sea un GET del propio origen se toca. Eso deja fuera Supabase,
  // /api, las URLs firmadas de Storage y cualquier POST/PATCH/DELETE.
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  // Navegaciones: siempre a la red. Si no hay red, la página de sin conexión.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Estáticos de Next: llevan hash en la URL, así que la copia guardada nunca
  // puede ser una versión vieja de nada.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (guardada) =>
          guardada ||
          fetch(request).then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copia))
            }
            return respuesta
          }),
      ),
    )
  }
})
