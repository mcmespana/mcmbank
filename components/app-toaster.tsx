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
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      position="bottom-left"
    />
  )
}
