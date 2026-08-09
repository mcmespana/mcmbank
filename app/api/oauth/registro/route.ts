import { errorOAuth, redirectUriAceptable, registrarCliente } from "@/lib/oauth/store"
import {
  creadoOAuth,
  errorRespuestaOAuth,
  preflightOAuth,
  cuerpoOAuth,
} from "@/lib/oauth/respuestas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_REDIRECT_URIS = 10

/**
 * POST /api/oauth/registro — Registro dinámico de clientes (RFC 7591).
 *
 * Claude no sabe nada de MCM Bank hasta que alguien añade el conector: se
 * registra solo llamando aquí y recibe un `client_id`. El endpoint es abierto
 * porque así lo exige el flujo, y no es un agujero: **registrarse no da acceso
 * a nada**. Para obtener un token hace falta que una persona de la oficina
 * técnica inicie sesión en MCM Bank y apruebe la conexión en pantalla.
 *
 * No se emiten secretos de cliente: son aplicaciones públicas, que no pueden
 * guardarlos. Lo que ata el código a quien lo pidió es PKCE.
 */
export async function POST(request: Request) {
  try {
    const cuerpo = await cuerpoOAuth(request)

    const redirectUrisBruto = (cuerpo as any).redirect_uris
    const redirectUris: string[] = Array.isArray(redirectUrisBruto)
      ? redirectUrisBruto.map(String)
      : typeof redirectUrisBruto === "string" && redirectUrisBruto
        ? [redirectUrisBruto]
        : []

    if (redirectUris.length === 0) {
      throw errorOAuth("invalid_request", "Falta 'redirect_uris'.")
    }
    if (redirectUris.length > MAX_REDIRECT_URIS) {
      throw errorOAuth(
        "invalid_request",
        `Demasiadas 'redirect_uris' (${redirectUris.length}); el máximo son ${MAX_REDIRECT_URIS}.`,
      )
    }

    const invalidas = redirectUris.filter((uri) => !redirectUriAceptable(uri))
    if (invalidas.length > 0) {
      throw errorOAuth(
        "invalid_request",
        `Estas redirect_uris no valen: ${invalidas.join(", ")}. Se admite https, http solo en localhost, o un esquema propio de aplicación.`,
      )
    }

    const nombre = String(cuerpo.client_name ?? "").trim() || "Aplicación sin nombre"

    const cliente = await registrarCliente({
      nombre,
      redirectUris,
      metadata: cuerpo,
    })

    return creadoOAuth({
      client_id: cliente.client_id,
      client_id_issued_at: Math.floor(new Date(cliente.creado_en).getTime() / 1000),
      client_name: cliente.nombre,
      redirect_uris: cliente.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    })
  } catch (err) {
    return errorRespuestaOAuth(err)
  }
}

export async function OPTIONS() {
  return preflightOAuth()
}
