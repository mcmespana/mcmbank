"use client"

import { useEffect } from "react"

/**
 * Error boundary global: solo se activa si falla el propio layout raíz.
 * Debe renderizar sus propios <html>/<body> porque sustituye al layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Error global:", error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo ha ido mal</h2>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", opacity: 0.7 }}>
          Ha ocurrido un error inesperado al cargar la aplicación.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #2b303b",
            background: "#fafafa",
            color: "#0a0a0a",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  )
}
