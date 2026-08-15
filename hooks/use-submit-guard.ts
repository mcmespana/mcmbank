"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Evita que un formulario se envíe dos veces.
 *
 * `disabled={enviando}` por sí solo no basta cuando el estado se actualiza
 * dentro del propio manejador: entre el primer clic y el re-render hay un hueco
 * en el que el botón sigue activo, y en móvil un doble toque cae justo ahí. El
 * cerrojo de verdad es el `ref`, que se cierra de forma síncrona; el estado
 * existe solo para poder pintar el botón deshabilitado.
 *
 * ```tsx
 * const { enviando, guard } = useSubmitGuard()
 * <form onSubmit={guard(async (e) => { ... })}>
 *   <Button type="submit" disabled={enviando}>Crear</Button>
 * ```
 */
export function useSubmitGuard() {
  const enVuelo = useRef(false)
  const [enviando, setEnviando] = useState(false)

  const guard = useCallback(
    <A extends unknown[]>(accion: (...args: A) => void | Promise<void>) =>
      async (...args: A) => {
        // El preventDefault va antes del cerrojo: si no, el segundo envío
        // recargaría la página en lugar de descartarse.
        const evento = args[0] as { preventDefault?: () => void } | undefined
        if (evento && typeof evento.preventDefault === "function") evento.preventDefault()

        if (enVuelo.current) return
        enVuelo.current = true
        setEnviando(true)
        try {
          await accion(...args)
        } finally {
          enVuelo.current = false
          setEnviando(false)
        }
      },
    [],
  )

  return { enviando, guard }
}

export default useSubmitGuard
