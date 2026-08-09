import {
  normalizarScopes,
  resourceValido,
  type ScopeOAuth,
} from "@/lib/oauth/config"
import {
  obtenerCliente,
  redirectUriRegistrada,
  type ClienteOAuth,
  type CodigoErrorOAuth,
} from "@/lib/oauth/store"

/**
 * Validación de una petición de autorización, compartida entre la pantalla de
 * consentimiento y el POST que la resuelve.
 *
 * Está en un solo sitio a propósito: si la pantalla validara una cosa y el POST
 * otra, bastaría con manipular un campo oculto del formulario para saltarse la
 * comprobación. El POST vuelve a validar desde cero con esta misma función.
 *
 * Hay dos clases de error, y la diferencia importa:
 *
 *   - **fatal**: falla el `client_id` o la `redirect_uri`. NO se puede
 *     redirigir, porque no sabemos a dónde sería seguro hacerlo; se enseña el
 *     error en pantalla.
 *   - **redirigible**: la `redirect_uri` ya está verificada y el problema es
 *     otro (falta PKCE, `response_type` raro…). Entonces sí se devuelve el
 *     error al cliente por la redirección, como manda OAuth.
 */

export interface ParametrosAutorizacion {
  client_id?: string
  redirect_uri?: string
  response_type?: string
  code_challenge?: string
  code_challenge_method?: string
  scope?: string
  state?: string
  resource?: string
}

export interface AutorizacionValida {
  ok: true
  cliente: ClienteOAuth
  redirectUri: string
  codeChallenge: string
  scopes: ScopeOAuth[]
  state: string | null
  resource: string | null
}

export interface AutorizacionFatal {
  ok: false
  tipo: "fatal"
  mensaje: string
}

export interface AutorizacionRedirigible {
  ok: false
  tipo: "redirigible"
  redirectUri: string
  error: CodigoErrorOAuth
  descripcion: string
  state: string | null
}

export type ResultadoValidacion = AutorizacionValida | AutorizacionFatal | AutorizacionRedirigible

export async function validarAutorizacion(
  params: ParametrosAutorizacion,
  origen: string,
): Promise<ResultadoValidacion> {
  const clientId = params.client_id?.trim()
  const redirectUri = params.redirect_uri?.trim()
  const state = params.state?.trim() || null

  if (!clientId) {
    return { ok: false, tipo: "fatal", mensaje: "La petición no indica qué aplicación pide acceso (falta 'client_id')." }
  }

  const cliente = await obtenerCliente(clientId)
  if (!cliente) {
    return {
      ok: false,
      tipo: "fatal",
      mensaje:
        "Esa aplicación no está registrada en MCM Bank. Si acabas de añadir el conector, quítalo y vuelve a añadirlo.",
    }
  }

  if (!redirectUri) {
    return { ok: false, tipo: "fatal", mensaje: "La petición no indica a dónde volver (falta 'redirect_uri')." }
  }
  if (!redirectUriRegistrada(cliente, redirectUri)) {
    return {
      ok: false,
      tipo: "fatal",
      mensaje:
        "La dirección de retorno no coincide con ninguna de las que registró la aplicación. Por seguridad no se continúa.",
    }
  }

  // A partir de aquí la redirect_uri es de fiar: los errores se devuelven por ella.
  const redirigible = (error: CodigoErrorOAuth, descripcion: string): AutorizacionRedirigible => ({
    ok: false,
    tipo: "redirigible",
    redirectUri,
    error,
    descripcion,
    state,
  })

  if ((params.response_type ?? "").trim() !== "code") {
    return redirigible("invalid_request", "Solo se admite response_type=code.")
  }

  const codeChallenge = params.code_challenge?.trim()
  if (!codeChallenge) {
    return redirigible("invalid_request", "Falta 'code_challenge': PKCE es obligatorio.")
  }
  const metodo = (params.code_challenge_method ?? "").trim()
  if (metodo !== "S256") {
    return redirigible(
      "invalid_request",
      "Solo se admite code_challenge_method=S256 (el método 'plain' no es seguro).",
    )
  }

  if (!resourceValido(params.resource?.trim() || null, origen)) {
    return redirigible(
      "invalid_request",
      "El parámetro 'resource' no apunta al servidor MCP de MCM Bank.",
    )
  }

  const scopes = normalizarScopes(params.scope)
  if (scopes.length === 0) {
    return redirigible(
      "invalid_scope",
      "Ninguno de los permisos pedidos existe. Los válidos son mcm:read y mcm:write.",
    )
  }

  return {
    ok: true,
    cliente,
    redirectUri,
    codeChallenge,
    scopes,
    state,
    resource: params.resource?.trim() || null,
  }
}

/** Monta la URL de vuelta al cliente con un error de OAuth. */
export function urlDeError(datos: AutorizacionRedirigible): string {
  const url = new URL(datos.redirectUri)
  url.searchParams.set("error", datos.error)
  url.searchParams.set("error_description", datos.descripcion)
  if (datos.state) url.searchParams.set("state", datos.state)
  return url.toString()
}

/** Monta la URL de vuelta al cliente con el código concedido. */
export function urlDeExito(redirectUri: string, codigo: string, state: string | null): string {
  const url = new URL(redirectUri)
  url.searchParams.set("code", codigo)
  if (state) url.searchParams.set("state", state)
  return url.toString()
}
