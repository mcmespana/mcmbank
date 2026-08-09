import { NextResponse } from "next/server"

/**
 * Error con código HTTP para la API externa y el servidor MCP.
 *
 * Las capas de dominio (`lib/api/*.ts`) lanzan `ApiError` con un mensaje en
 * español pensado para que lo lea una persona **o un modelo**: si el mensaje
 * explica qué falta y cómo arreglarlo, el agente puede corregirse solo sin
 * volver a preguntar al usuario.
 */
export class ApiError extends Error {
  readonly status: number
  /** Datos extra que ayudan a corregir la llamada (candidatos, valores válidos…). */
  readonly detalles?: unknown

  constructor(status: number, message: string, detalles?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detalles = detalles
  }
}

export const badRequest = (message: string, detalles?: unknown) =>
  new ApiError(400, message, detalles)
export const notFound = (message: string, detalles?: unknown) =>
  new ApiError(404, message, detalles)
export const conflict = (message: string, detalles?: unknown) =>
  new ApiError(409, message, detalles)
export const misconfigured = (message: string, detalles?: unknown) =>
  new ApiError(500, message, detalles)

/**
 * Convierte un error de Supabase/PostgREST (un objeto plano, no una instancia
 * de `Error`) en un `Error` real, para que `err.message` no acabe siendo
 * `"[object Object]"`.
 */
export function wrapSupabaseError(error: unknown): Error {
  if (error instanceof Error) return error
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown }
    // Solo la primera línea de cada parte: cuando el fallo es de red,
    // supabase-js mete la traza de pila entera en `details`.
    const partes = [e.message, e.details, e.hint]
      .filter(Boolean)
      .map((parte) => String(parte).split("\n")[0].trim())
      .filter(Boolean)
    if (partes.length > 0) return new Error(partes.join(" · "))
  }
  return new Error("Error desconocido de Supabase.")
}

/** Lanza si la respuesta de Supabase trae error; si no, devuelve los datos. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw wrapSupabaseError(res.error)
  return res.data
}

export interface ErrorPayload {
  ok: false
  error: string
  detalles?: unknown
}

/**
 * Normaliza cualquier error a `{ status, body }` para una respuesta HTTP.
 *
 * Los `ApiError` se devuelven tal cual: su mensaje está escrito para leerse.
 * Lo demás es un fallo inesperado —una caída de red, un error de Postgres—: se
 * registra entero en el servidor y hacia fuera solo sale la primera línea,
 * recortada, para no publicar trazas de pila ni rutas internas.
 */
export function toErrorPayload(err: unknown): { status: number; body: ErrorPayload } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { ok: false, error: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) },
    }
  }

  console.error("[api] Error no controlado:", err)
  const bruto = err instanceof Error ? err.message : String(err)
  const primeraLinea = bruto.split("\n")[0].trim()
  const message = primeraLinea.length > 300 ? `${primeraLinea.slice(0, 299)}…` : primeraLinea

  return { status: 500, body: { ok: false, error: message || "Error interno." } }
}

/** Respuesta JSON de error lista para devolver desde un route handler. */
export function errorResponse(err: unknown): NextResponse {
  const { status, body } = toErrorPayload(err)
  return NextResponse.json(body, { status })
}
