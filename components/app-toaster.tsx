"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sonner"

/**
 * El `theme` de Sonner es "light" por defecto y **no sigue al sistema**: sin
 * esto los toasts salían claros sobre la app en oscuro. No vale `theme="system"`
 * porque aquí el usuario puede forzar claro/oscuro por encima de la preferencia
 * del SO; la verdad es el `resolvedTheme` de next-themes.
 *
 * Va en su propio componente porque `useTheme()` necesita estar por debajo del
 * `ThemeProvider`, y `AppProviders` es quien lo renderiza.
 *
 * Posición: abajo a la izquierda porque abajo a la derecha vive el botón
 * flotante de avisos (y su panel de 27rem). El `left` no es fijo: se aparta del
 * menú lateral, que es fijo y mide 18rem o 4rem plegado. Sin eso el toast se
 * dibujaba encima del menú —Sonner se pinta con z-index 999999, así que gana
 * siempre— y quedaba a caballo entre el panel lateral y el contenido.
 * `--mcm-toaster-left` se define en globals.css y la anchura del menú la publica
 * `app-layout.tsx`.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      position="bottom-left"
      offset={{ left: "var(--mcm-toaster-left)" }}
    />
  )
}
