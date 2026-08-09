import { revocarToken } from "@/lib/oauth/store"
import { cuerpoOAuth, errorRespuestaOAuth, okOAuth, preflightOAuth } from "@/lib/oauth/respuestas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/oauth/revocar — revocación de tokens (RFC 7009).
 *
 * Responde 200 siempre, incluso si el token no existía: el estándar lo exige
 * así a propósito, para no convertir el endpoint en un oráculo que confirme si
 * un token es válido.
 */
export async function POST(request: Request) {
  try {
    const cuerpo = await cuerpoOAuth(request)
    const token = cuerpo.token?.trim()
    if (token) await revocarToken(token)
    return okOAuth({})
  } catch (err) {
    return errorRespuestaOAuth(err)
  }
}

export async function OPTIONS() {
  return preflightOAuth()
}
