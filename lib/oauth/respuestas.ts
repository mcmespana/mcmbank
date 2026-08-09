import { NextResponse } from "next/server"
import { ErrorOAuth } from "@/lib/oauth/store"

/**
 * Respuestas de los endpoints OAuth.
 *
 * OAuth tiene su propio formato de error (`{ error, error_description }`), que
 * no es el `{ ok: false, error }` del resto de la API: los clientes lo parsean
 * y actúan según el código, así que aquí manda el estándar.
 */

export const CORS_OAUTH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
}

/** Los endpoints OAuth no deben cachearse nunca (RFC 6749 §5.1). */
const SIN_CACHE = { "Cache-Control": "no-store", Pragma: "no-cache" }

export function okOAuth(datos: object): NextResponse {
  return NextResponse.json(datos, { headers: { ...SIN_CACHE, ...CORS_OAUTH } })
}

export function creadoOAuth(datos: object): NextResponse {
  return NextResponse.json(datos, { status: 201, headers: { ...SIN_CACHE, ...CORS_OAUTH } })
}

export function errorRespuestaOAuth(err: unknown): NextResponse {
  if (err instanceof ErrorOAuth) {
    return NextResponse.json(
      { error: err.codigoOAuth, error_description: err.message },
      { status: err.status, headers: { ...SIN_CACHE, ...CORS_OAUTH } },
    )
  }

  console.error("[oauth] Error no controlado:", err)
  const bruto = err instanceof Error ? err.message : String(err)
  return NextResponse.json(
    { error: "server_error", error_description: bruto.split("\n")[0].slice(0, 300) },
    { status: 500, headers: { ...SIN_CACHE, ...CORS_OAUTH } },
  )
}

export function preflightOAuth(): Response {
  return new Response(null, { status: 204, headers: CORS_OAUTH })
}

/**
 * Lee el cuerpo de una petición OAuth. El estándar manda
 * `application/x-www-form-urlencoded`, pero varios clientes envían JSON; se
 * aceptan los dos porque rechazar el segundo solo genera incidencias.
 */
export async function cuerpoOAuth(request: Request): Promise<Record<string, string>> {
  const tipo = request.headers.get("content-type") ?? ""

  if (tipo.includes("application/json")) {
    const json = await request.json().catch(() => ({}))
    const salida: Record<string, string> = {}
    for (const [clave, valor] of Object.entries(json ?? {})) {
      if (valor != null) salida[clave] = String(valor)
    }
    return salida
  }

  const texto = await request.text()
  const params = new URLSearchParams(texto)
  return Object.fromEntries(params.entries())
}
