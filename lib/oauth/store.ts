import { createHash, randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { ApiError, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { verificarPkce } from "@/lib/oauth/pkce"
import {
  TTL_ACCESS_TOKEN_S,
  TTL_CODIGO_S,
  TTL_REFRESH_TOKEN_S,
  type ScopeOAuth,
} from "@/lib/oauth/config"

/**
 * Almacén de clientes, códigos y tokens OAuth.
 *
 * De códigos y tokens solo se guarda su **SHA-256**, igual que se haría con una
 * contraseña: si alguien se lleva una copia de la base de datos no puede
 * suplantar a nadie. Un hash sin sal basta aquí porque el secreto son 32 bytes
 * aleatorios, no algo adivinable por fuerza bruta.
 *
 * Las tres tablas tienen RLS activada y ninguna política: solo se llega con la
 * service role key, desde el servidor.
 */

type AdminClient = ReturnType<typeof createAdminClient>

function admin(): AdminClient {
  return createAdminClient()
}

/** Secreto aleatorio en base64url (32 bytes ≈ 256 bits). */
function nuevoSecreto(): string {
  return randomBytes(32).toString("base64url")
}

function hash(valor: string): string {
  return createHash("sha256").update(valor).digest("hex")
}

function enSegundos(segundos: number): string {
  return new Date(Date.now() + segundos * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Clientes (registro dinámico, RFC 7591)
// ---------------------------------------------------------------------------

export interface ClienteOAuth {
  client_id: string
  nombre: string
  redirect_uris: string[]
  creado_en: string
}

/**
 * Comprueba que una `redirect_uri` es aceptable antes de registrarla.
 *
 * Se permite https en cualquier host y http **solo** en localhost (los clientes
 * de escritorio abren un servidor local para recibir el código). También se
 * aceptan esquemas propios tipo `claude://…`, que es como vuelven las apps
 * nativas. Lo que no se acepta es `http://` a un dominio externo: ahí el código
 * viajaría en claro.
 */
export function redirectUriAceptable(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }

  if (url.hash) return false // el fragmento no se envía al servidor: señal de mal uso

  if (url.protocol === "https:") return true
  if (url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
  }
  // Esquema propio de una app nativa (claude://, cursor://…).
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && url.protocol !== "javascript:" && url.protocol !== "data:"
}

export async function registrarCliente(params: {
  nombre: string
  redirectUris: string[]
  metadata?: unknown
}): Promise<ClienteOAuth> {
  const clientId = `mcm-${randomBytes(16).toString("hex")}`

  const fila = unwrap(
    await (admin() as any)
      .from("mcp_oauth_cliente")
      .insert({
        client_id: clientId,
        nombre: params.nombre.slice(0, 200),
        redirect_uris: params.redirectUris,
        metadata: params.metadata ?? null,
      })
      .select("client_id, nombre, redirect_uris, creado_en")
      .single(),
  ) as ClienteOAuth

  return fila
}

export async function obtenerCliente(clientId: string): Promise<ClienteOAuth | null> {
  if (!clientId) return null
  const fila = unwrap(
    await (admin() as any)
      .from("mcp_oauth_cliente")
      .select("client_id, nombre, redirect_uris, creado_en")
      .eq("client_id", clientId)
      .maybeSingle(),
  )
  return (fila as ClienteOAuth) ?? null
}

/** La `redirect_uri` debe coincidir **exactamente** con una registrada. */
export function redirectUriRegistrada(cliente: ClienteOAuth, redirectUri: string): boolean {
  return cliente.redirect_uris.includes(redirectUri)
}

// ---------------------------------------------------------------------------
// Códigos de autorización
// ---------------------------------------------------------------------------

export interface DatosCodigo {
  clientId: string
  usuarioId: string
  redirectUri: string
  codeChallenge: string
  scopes: ScopeOAuth[]
  resource: string | null
}

export async function crearCodigo(datos: DatosCodigo): Promise<string> {
  const codigo = nuevoSecreto()

  const { error } = await (admin() as any).from("mcp_oauth_codigo").insert({
    codigo_hash: hash(codigo),
    client_id: datos.clientId,
    usuario_id: datos.usuarioId,
    redirect_uri: datos.redirectUri,
    code_challenge: datos.codeChallenge,
    code_challenge_method: "S256",
    scope: datos.scopes.join(" "),
    resource: datos.resource,
    expira_en: enSegundos(TTL_CODIGO_S),
  })
  if (error) throw wrapSupabaseError(error)

  return codigo
}

export interface CodigoCanjeado {
  clientId: string
  usuarioId: string
  scopes: string
  resource: string | null
}

/**
 * Canjea un código por su contenido, de una sola vez.
 *
 * Si alguien intenta reutilizar un código ya gastado se revocan **todos** los
 * tokens de ese cliente y usuario: la reutilización solo ocurre cuando el
 * código se ha filtrado, y en ese caso más vale obligar a volver a entrar que
 * dejar viva una sesión que quizá no es de quien creemos (RFC 6819, §5.2.1.1).
 */
export async function canjearCodigo(params: {
  codigo: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): Promise<CodigoCanjeado> {
  const cliente = admin() as any
  const codigoHash = hash(params.codigo)

  const fila = unwrap(
    await cliente.from("mcp_oauth_codigo").select("*").eq("codigo_hash", codigoHash).maybeSingle(),
  ) as any

  if (!fila) throw errorOAuth("invalid_grant", "El código de autorización no existe o ya caducó.")

  if (fila.usado_en) {
    await revocarTokensDe(fila.client_id, fila.usuario_id)
    throw errorOAuth(
      "invalid_grant",
      "Ese código ya se había usado. Por seguridad se han cerrado las sesiones de esta aplicación: vuelve a conectarla.",
    )
  }
  if (new Date(fila.expira_en).getTime() < Date.now()) {
    throw errorOAuth("invalid_grant", "El código de autorización ha caducado (duran 5 minutos).")
  }
  if (fila.client_id !== params.clientId) {
    throw errorOAuth("invalid_grant", "El código no pertenece a esta aplicación.")
  }
  if (fila.redirect_uri !== params.redirectUri) {
    throw errorOAuth("invalid_grant", "La redirect_uri no coincide con la que se usó al autorizar.")
  }
  if (!params.codeVerifier || !verificarPkce(params.codeVerifier, fila.code_challenge)) {
    throw errorOAuth("invalid_grant", "El code_verifier no corresponde al code_challenge (PKCE).")
  }

  // Marcar como usado solo si seguía sin usar: si dos peticiones llegan a la
  // vez, únicamente una se lleva el código.
  const { data: marcado, error } = await cliente
    .from("mcp_oauth_codigo")
    .update({ usado_en: new Date().toISOString() })
    .eq("codigo_hash", codigoHash)
    .is("usado_en", null)
    .select("codigo_hash")
  if (error) throw wrapSupabaseError(error)
  if (!marcado || marcado.length === 0) {
    throw errorOAuth("invalid_grant", "Ese código ya se había usado.")
  }

  return {
    clientId: fila.client_id,
    usuarioId: fila.usuario_id,
    scopes: fila.scope,
    resource: fila.resource ?? null,
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export interface TokensEmitidos {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}

export async function emitirTokens(params: {
  clientId: string
  usuarioId: string
  scope: string
  resource: string | null
}): Promise<TokensEmitidos> {
  const accessToken = nuevoSecreto()
  const refreshToken = nuevoSecreto()

  const comun = {
    client_id: params.clientId,
    usuario_id: params.usuarioId,
    scope: params.scope,
    resource: params.resource,
  }

  const { error } = await (admin() as any).from("mcp_oauth_token").insert([
    { ...comun, token_hash: hash(accessToken), tipo: "access", expira_en: enSegundos(TTL_ACCESS_TOKEN_S) },
    { ...comun, token_hash: hash(refreshToken), tipo: "refresh", expira_en: enSegundos(TTL_REFRESH_TOKEN_S) },
  ])
  if (error) throw wrapSupabaseError(error)

  return {
    accessToken,
    refreshToken,
    expiresIn: TTL_ACCESS_TOKEN_S,
    scope: params.scope,
  }
}

export interface TokenValido {
  usuarioId: string
  clientId: string
  scopes: string[]
  resource: string | null
}

/**
 * Valida un token de acceso. Devuelve `null` si no vale (no lanza: quien llama
 * decide si eso es un 401 o simplemente "no era un token OAuth").
 */
export async function validarAccessToken(token: string): Promise<TokenValido | null> {
  if (!token) return null

  const fila = unwrap(
    await (admin() as any)
      .from("mcp_oauth_token")
      .select("client_id, usuario_id, scope, resource, tipo, expira_en, revocado_en")
      .eq("token_hash", hash(token))
      .maybeSingle(),
  ) as any

  if (!fila) return null
  if (fila.tipo !== "access") return null
  if (fila.revocado_en) return null
  if (new Date(fila.expira_en).getTime() < Date.now()) return null

  // Sello de último uso, sin bloquear la respuesta si falla.
  void (admin() as any)
    .from("mcp_oauth_token")
    .update({ ultimo_uso_en: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .then(undefined, () => undefined)

  return {
    usuarioId: fila.usuario_id,
    clientId: fila.client_id,
    scopes: String(fila.scope ?? "").split(" ").filter(Boolean),
    resource: fila.resource ?? null,
  }
}

/**
 * Canjea un token de refresco por uno nuevo. Se rota también el refresco (el
 * viejo queda revocado): si alguien se lleva una copia, en cuanto el legítimo
 * lo use el robado deja de valer.
 */
export async function refrescarTokens(params: {
  refreshToken: string
  clientId: string
  scopePedido: string | null
}): Promise<TokensEmitidos> {
  const cliente = admin() as any
  const tokenHash = hash(params.refreshToken)

  const fila = unwrap(
    await cliente.from("mcp_oauth_token").select("*").eq("token_hash", tokenHash).maybeSingle(),
  ) as any

  if (!fila || fila.tipo !== "refresh") {
    throw errorOAuth("invalid_grant", "El token de refresco no existe.")
  }
  if (fila.revocado_en) {
    // Refresco ya rotado: huele a copia robada. Se cierra todo.
    await revocarTokensDe(fila.client_id, fila.usuario_id)
    throw errorOAuth(
      "invalid_grant",
      "Ese token de refresco ya se había usado. Por seguridad se han cerrado las sesiones: vuelve a conectar la aplicación.",
    )
  }
  if (new Date(fila.expira_en).getTime() < Date.now()) {
    throw errorOAuth("invalid_grant", "El token de refresco ha caducado. Vuelve a conectar la aplicación.")
  }
  if (fila.client_id !== params.clientId) {
    throw errorOAuth("invalid_grant", "El token de refresco no pertenece a esta aplicación.")
  }

  // El cliente puede pedir menos permisos, nunca más (RFC 6749 §6).
  const concedidos = String(fila.scope ?? "").split(" ").filter(Boolean)
  const scope = params.scopePedido
    ? params.scopePedido
        .split(/[\s+]+/)
        .filter((s) => concedidos.includes(s))
        .join(" ")
    : fila.scope

  if (!scope) throw errorOAuth("invalid_scope", "Los permisos pedidos no estaban concedidos.")

  await cliente
    .from("mcp_oauth_token")
    .update({ revocado_en: new Date().toISOString() })
    .eq("token_hash", tokenHash)

  return emitirTokens({
    clientId: fila.client_id,
    usuarioId: fila.usuario_id,
    scope,
    resource: fila.resource ?? null,
  })
}

/** Revoca un token concreto (RFC 7009). Idempotente y silencioso. */
export async function revocarToken(token: string): Promise<void> {
  await (admin() as any)
    .from("mcp_oauth_token")
    .update({ revocado_en: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .is("revocado_en", null)
}

/** Revoca todo lo vivo de un cliente para un usuario. */
export async function revocarTokensDe(clientId: string, usuarioId: string): Promise<void> {
  await (admin() as any)
    .from("mcp_oauth_token")
    .update({ revocado_en: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("usuario_id", usuarioId)
    .is("revocado_en", null)
}

/** Borra códigos y tokens caducados. Barato; se llama al emitir tokens. */
export async function limpiarCaducado(): Promise<void> {
  await (admin() as any)
    .rpc("limpiar_mcp_oauth_caducado")
    .then(undefined, () => undefined)
}

// ---------------------------------------------------------------------------
// Errores en el formato que espera OAuth
// ---------------------------------------------------------------------------

/** Códigos de error de OAuth 2.1 (RFC 6749 §5.2). */
export type CodigoErrorOAuth =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "access_denied"
  | "server_error"

export class ErrorOAuth extends ApiError {
  readonly codigoOAuth: CodigoErrorOAuth

  constructor(codigo: CodigoErrorOAuth, descripcion: string, status = 400) {
    super(status, descripcion)
    this.name = "ErrorOAuth"
    this.codigoOAuth = codigo
  }
}

export function errorOAuth(
  codigo: CodigoErrorOAuth,
  descripcion: string,
  status = 400,
): ErrorOAuth {
  return new ErrorOAuth(codigo, descripcion, status)
}
