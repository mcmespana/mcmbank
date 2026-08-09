import { NextResponse } from "next/server"
import { verifyApiKey, type ApiScope } from "@/lib/api/external-auth"
import { badRequest, errorResponse } from "@/lib/api/errors"
import type { ActorHint } from "@/lib/api/actor"

/**
 * Andamiaje común de las rutas de `/api/v1`: autenticación, lectura de
 * parámetros y forma homogénea de la respuesta (`{ ok: true, ... }` o
 * `{ ok: false, error }`).
 */

export interface PeticionApi {
  scope: ApiScope
  baseUrl: string
  actorHint: ActorHint
  params: URLSearchParams
}

/**
 * Ejecuta el cuerpo de una ruta con la clave ya verificada. Devuelve la
 * respuesta de error si la autenticación falla, y convierte cualquier `ApiError`
 * en su código HTTP correspondiente.
 */
export async function conApi(
  request: Request,
  scopeRequerido: ApiScope,
  fn: (ctx: PeticionApi) => Promise<object>,
): Promise<NextResponse> {
  const auth = verifyApiKey(request, scopeRequerido)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  try {
    const datos = await fn({
      scope: auth.scope,
      baseUrl: `${url.protocol}//${url.host}`,
      actorHint: {
        usuario_email: request.headers.get("x-mcm-usuario-email"),
        usuario_id: request.headers.get("x-mcm-usuario-id"),
      },
      params: url.searchParams,
    })
    return NextResponse.json({ ok: true, ...datos })
  } catch (err) {
    return errorResponse(err)
  }
}

/** Lee y valida el cuerpo JSON de una petición. */
export async function cuerpoJson(request: Request): Promise<Record<string, unknown>> {
  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    throw badRequest("El cuerpo de la petición no es JSON válido.")
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    throw badRequest("El cuerpo de la petición debe ser un objeto JSON.")
  }
  return cuerpo as Record<string, unknown>
}

// --- Lectura de parámetros de la query string -------------------------------

export function qTexto(params: URLSearchParams, clave: string): string | undefined {
  const valor = params.get(clave)
  return valor?.trim() || undefined
}

export function qNumero(params: URLSearchParams, clave: string): number | undefined {
  const valor = qTexto(params, clave)
  if (valor === undefined) return undefined
  const n = Number(valor.replace(",", "."))
  if (!Number.isFinite(n)) throw badRequest(`'${clave}' debe ser un número (ha llegado '${valor}').`)
  return n
}

export function qBooleano(params: URLSearchParams, clave: string): boolean | undefined {
  const valor = qTexto(params, clave)?.toLowerCase()
  if (valor === undefined) return undefined
  if (["true", "1", "si", "sí"].includes(valor)) return true
  if (["false", "0", "no"].includes(valor)) return false
  throw badRequest(`'${clave}' debe ser true o false (ha llegado '${valor}').`)
}

/**
 * Lista de valores: admite tanto `?delegaciones=a&delegaciones=b` como
 * `?delegaciones=a,b`, que es lo que se escribe a mano en un `curl`.
 */
export function qLista(params: URLSearchParams, clave: string): string[] | undefined {
  const valores = params.getAll(clave).flatMap((v) => v.split(","))
  const limpios = valores.map((v) => v.trim()).filter(Boolean)
  return limpios.length > 0 ? limpios : undefined
}

export function qOpcion<T extends string>(
  params: URLSearchParams,
  clave: string,
  validos: readonly T[],
): T | undefined {
  const valor = qTexto(params, clave)
  if (valor === undefined) return undefined
  if (!validos.includes(valor as T)) {
    throw badRequest(`'${valor}' no vale para '${clave}'.`, { valores_validos: validos })
  }
  return valor as T
}
