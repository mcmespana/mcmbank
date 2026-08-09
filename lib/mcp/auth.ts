import type { ActorHint } from "@/lib/api/actor"
import { verifyApiKey, type ApiScope } from "@/lib/api/external-auth"
import { RUTAS, SCOPES, origenDe } from "@/lib/oauth/config"
import { validarAccessToken } from "@/lib/oauth/store"

/**
 * Autenticación del servidor MCP. Dos caminos, misma puerta:
 *
 *   1. **Clave de API** (`MCM_API_KEY`): lo que usan Claude Code y los scripts.
 *      Sencillo, pero la clave no es una persona, así que la autoría de las
 *      escrituras hay que decirla aparte.
 *
 *   2. **Token OAuth**: lo que usa el conector de claude.ai. Cada persona entra
 *      con su cuenta, y el token *es* su identidad: las escrituras se firman
 *      solas con ella y no hay forma de suplantar a nadie desde la conversación.
 *
 * Se prueba primero la clave (no toca la base de datos) y luego el token.
 */

export type ViaAutenticacion = "clave" | "oauth"

export interface AutorizacionMcp {
  scope: ApiScope
  actorHint: ActorHint
  /**
   * Con OAuth, el usuario del token manda y no se admiten pistas de autoría:
   * si el modelo pudiera indicar otro correo, firmaría en nombre de terceros.
   */
  actorForzado: string | null
  via: ViaAutenticacion
}

export interface RechazoMcp {
  status: number
  error: string
  cabeceras: Record<string, string>
}

export type ResultadoAutorizacion =
  | { ok: true; auth: AutorizacionMcp }
  | { ok: false; rechazo: RechazoMcp }

function tokenDe(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null
  }
  return request.headers.get("x-api-key")?.trim() || null
}

/**
 * Cabecera que le dice al cliente dónde están los metadatos del recurso, para
 * que sepa contra qué servidor de autorización pedir un token (RFC 9728 §5.1).
 * Es lo que hace que un conector de claude.ai arranque el flujo de OAuth solo.
 */
function desafio(request: Request, descripcion?: string): Record<string, string> {
  const origen = origenDe(request)
  const partes = [
    `Bearer realm="MCM Bank"`,
    `resource_metadata="${origen}${RUTAS.metadatosRecurso}"`,
  ]
  if (descripcion) partes.push(`error="invalid_token"`, `error_description="${descripcion}"`)
  return { "WWW-Authenticate": partes.join(", ") }
}

export async function autorizarMcp(request: Request): Promise<ResultadoAutorizacion> {
  const token = tokenDe(request)

  if (!token) {
    return {
      ok: false,
      rechazo: {
        status: 401,
        error:
          "Hace falta autenticarse. Conecta el servidor desde claude.ai (te llevará a iniciar sesión) o envía la clave de API en 'Authorization: Bearer <clave>'.",
        cabeceras: desafio(request),
      },
    }
  }

  // 1) ¿Es una clave de API configurada?
  const porClave = verifyApiKey(request)
  if (porClave.ok) {
    return {
      ok: true,
      auth: {
        scope: porClave.scope,
        actorHint: {
          usuario_email: request.headers.get("x-mcm-usuario-email"),
          usuario_id: request.headers.get("x-mcm-usuario-id"),
        },
        actorForzado: null,
        via: "clave",
      },
    }
  }

  // 2) ¿Es un token OAuth vivo? Si la base de datos no contesta, eso no es
  // "credencial inválida": decirlo así mandaría al cliente a repetir el login
  // para nada. Se distingue el fallo de infraestructura del rechazo.
  let porToken: Awaited<ReturnType<typeof validarAccessToken>>
  try {
    porToken = await validarAccessToken(token)
  } catch (err) {
    console.error("[mcp] No se pudo validar el token OAuth:", err)
    return {
      ok: false,
      rechazo: {
        status: 503,
        error:
          "No se ha podido comprobar la credencial contra la base de datos. Vuelve a intentarlo en un momento.",
        cabeceras: {},
      },
    }
  }

  if (porToken) {
    return {
      ok: true,
      auth: {
        scope: porToken.scopes.includes(SCOPES.ESCRIBIR) ? "write" : "read",
        actorHint: { usuario_id: porToken.usuarioId },
        actorForzado: porToken.usuarioId,
        via: "oauth",
      },
    }
  }

  // Ni una cosa ni la otra. Si el servidor no tiene ninguna clave configurada,
  // eso es un fallo de despliegue y conviene decirlo tal cual.
  if (porClave.status === 500) {
    return { ok: false, rechazo: { status: 500, error: porClave.error, cabeceras: {} } }
  }

  return {
    ok: false,
    rechazo: {
      status: 401,
      error:
        "La credencial no es válida o ha caducado. Si te conectaste desde claude.ai, vuelve a conectar el servidor; si usas una clave de API, revísala.",
      cabeceras: desafio(request, "token invalido o caducado"),
    },
  }
}
