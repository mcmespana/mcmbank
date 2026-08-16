"use client"

import { useEffect } from "react"

/**
 * Registra `public/sw.js`, que es lo que hace que la app se pueda instalar.
 *
 * Va en un componente y no en un `<script>` suelto porque el registro tiene que
 * ocurrir después de la hidratación: hacerlo antes compite por ancho de banda
 * con el propio arranque de la aplicación, y lo que menos importa aquí es tener
 * el service worker listo cuanto antes.
 *
 * Solo en producción: en `pnpm dev` un service worker interfiere con la
 * recarga en caliente y hace perder media tarde persiguiendo un bug que no
 * existe.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Que falle no rompe nada: la app funciona igual, solo deja de poder
        // instalarse. No merece molestar al usuario con un aviso.
        console.warn("No se pudo registrar el service worker:", error)
      })
    }

    if (document.readyState === "complete") {
      registrar()
      return
    }
    window.addEventListener("load", registrar)
    return () => window.removeEventListener("load", registrar)
  }, [])

  return null
}
