"use client"

import { useEffect, useState } from "react"

/**
 * Devuelve true cuando el viewport está por debajo de `breakpointPx`.
 *
 * Empieza en `false` en el primer render (no hay window en SSR) y se ajusta
 * tras el montaje. Úsalo para evitar montar dos veces el mismo componente
 * (versión escritorio + móvil) cuando solo una debe estar activa.
 */
export function useIsMobile(breakpointPx = 1024) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [breakpointPx])

  return isMobile
}
