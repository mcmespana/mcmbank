/**
 * Constantes del servidor de autorización OAuth 2.1 que da acceso al MCP.
 *
 * MCM Bank hace aquí de servidor de autorización *y* de servidor de recursos:
 * es una aplicación interna con su propio login (Supabase Auth), y montar un
 * proveedor de identidad aparte para cinco personas de la oficina técnica sería
 * desproporcionado. La pantalla de consentimiento reutiliza la sesión que ya
 * tiene el navegador.
 */

/** Permisos que puede pedir un cliente. */
export const SCOPES = {
  LEER: "mcm:read",
  ESCRIBIR: "mcm:write",
} as const

export const SCOPES_SOPORTADOS = [SCOPES.LEER, SCOPES.ESCRIBIR] as const
export type ScopeOAuth = (typeof SCOPES_SOPORTADOS)[number]

/** Lo que se concede si el cliente no pide nada en concreto. */
export const SCOPE_POR_DEFECTO = `${SCOPES.LEER} ${SCOPES.ESCRIBIR}`

/**
 * Duraciones. El token de acceso es corto porque no hay forma de invalidarlo a
 * mitad de vida sin consultar la base de datos en cada llamada (que es lo que
 * hacemos, así que en realidad podría ser más largo; se queda en una hora por
 * costumbre y porque abarata la limpieza).
 */
export const TTL_CODIGO_S = 300 // 5 minutos
export const TTL_ACCESS_TOKEN_S = 60 * 60 // 1 hora
export const TTL_REFRESH_TOKEN_S = 30 * 24 * 60 * 60 // 30 días

/** Rutas del servidor de autorización, relativas al origen. */
export const RUTAS = {
  autorizar: "/oauth/autorizar",
  token: "/api/oauth/token",
  registro: "/api/oauth/registro",
  revocar: "/api/oauth/revocar",
  mcp: "/api/mcp",
  metadatosRecurso: "/.well-known/oauth-protected-resource",
  metadatosServidor: "/.well-known/oauth-authorization-server",
} as const

/** Origen público de la petición, respetando el proxy de Vercel. */
export function origenDe(request: Request): string {
  const reenviado = request.headers.get("x-forwarded-host")
  const protocolo = request.headers.get("x-forwarded-proto") ?? "https"
  if (reenviado) return `${protocolo}://${reenviado}`

  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

/** URL absoluta del recurso protegido (el propio servidor MCP). */
export function urlRecurso(origen: string): string {
  return `${origen}${RUTAS.mcp}`
}

/**
 * Comprueba que el `resource` que pide el cliente (RFC 8707) apunta a este
 * servidor MCP. Se compara sin barra final ni fragmento, que es lo que varía
 * entre clientes.
 */
export function resourceValido(resource: string | null, origen: string): boolean {
  if (!resource) return true // opcional: si no lo mandan, no se exige
  const normalizar = (u: string) => u.replace(/\/+$/, "").split("#")[0].toLowerCase()
  return normalizar(resource) === normalizar(urlRecurso(origen))
}

/** Reduce una lista de scopes a los soportados, sin duplicados y en orden. */
export function normalizarScopes(pedido: string | null | undefined): ScopeOAuth[] {
  if (!pedido?.trim()) return [...SCOPES_SOPORTADOS]
  const pedidos = new Set(pedido.split(/[\s+]+/).filter(Boolean))
  return SCOPES_SOPORTADOS.filter((s) => pedidos.has(s))
}
