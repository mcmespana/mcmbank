import {
  canjearCodigo,
  emitirTokens,
  errorOAuth,
  limpiarCaducado,
  obtenerCliente,
  refrescarTokens,
} from "@/lib/oauth/store"
import { cuerpoOAuth, errorRespuestaOAuth, okOAuth, preflightOAuth } from "@/lib/oauth/respuestas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/oauth/token — canje de código y refresco (RFC 6749, OAuth 2.1).
 *
 * Dos flujos:
 *   - `authorization_code`: el código que devolvió la pantalla de
 *     autorización, con su `code_verifier` de PKCE.
 *   - `refresh_token`: renovación. El refresco se **rota**: el viejo queda
 *     revocado, de modo que una copia robada deja de valer en cuanto el
 *     legítimo renueve.
 *
 * Sin autenticación de cliente: son aplicaciones públicas y quien manda es PKCE.
 */
export async function POST(request: Request) {
  try {
    const cuerpo = await cuerpoOAuth(request)
    const grantType = cuerpo.grant_type
    const clientId = cuerpo.client_id?.trim()

    // El tipo de concesión se comprueba antes de tocar la base de datos: si no
    // lo soportamos, el cliente merece leer 'unsupported_grant_type' y no un
    // error de infraestructura que no le dice nada.
    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      throw errorOAuth(
        "unsupported_grant_type",
        `'${grantType ?? "(vacío)"}' no está soportado. Usa 'authorization_code' o 'refresh_token'.`,
      )
    }

    if (!clientId) throw errorOAuth("invalid_client", "Falta 'client_id'.")
    const cliente = await obtenerCliente(clientId)
    if (!cliente) {
      throw errorOAuth(
        "invalid_client",
        "Esa aplicación no está registrada. Vuelve a conectar el servidor desde cero.",
        401,
      )
    }

    // Aprovechamos el paso por aquí para tirar lo caducado: sale gratis y
    // evita depender de un cron para algo que solo es higiene.
    void limpiarCaducado()

    if (grantType === "authorization_code") {
      const codigo = cuerpo.code
      const redirectUri = cuerpo.redirect_uri
      const codeVerifier = cuerpo.code_verifier

      if (!codigo) throw errorOAuth("invalid_request", "Falta 'code'.")
      if (!redirectUri) throw errorOAuth("invalid_request", "Falta 'redirect_uri'.")
      if (!codeVerifier) throw errorOAuth("invalid_request", "Falta 'code_verifier' (PKCE es obligatorio).")

      const canjeado = await canjearCodigo({ codigo, clientId, redirectUri, codeVerifier })
      const tokens = await emitirTokens({
        clientId: canjeado.clientId,
        usuarioId: canjeado.usuarioId,
        scope: canjeado.scopes,
        resource: canjeado.resource,
      })

      return okOAuth({
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      })
    }

    const refreshToken = cuerpo.refresh_token
    if (!refreshToken) throw errorOAuth("invalid_request", "Falta 'refresh_token'.")

    const tokens = await refrescarTokens({
      refreshToken,
      clientId,
      scopePedido: cuerpo.scope ?? null,
    })

    return okOAuth({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    })
  } catch (err) {
    return errorRespuestaOAuth(err)
  }
}

export async function OPTIONS() {
  return preflightOAuth()
}
