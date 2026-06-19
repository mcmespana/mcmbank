import { google } from "googleapis"
import { decryptSecret, encryptSecret } from "./crypto"

/** Tipo del cliente OAuth2 sin depender del paquete anidado google-auth-library. */
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>

/**
 * Servicio de integración con Google (Drive + Sheets) mediante OAuth2 por usuario.
 * SOLO servidor: usa secretos de entorno.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
]

export const PLANTILLA_MEMORIA_DEFAULT_ID =
  process.env.GOOGLE_MEMORIA_TEMPLATE_ID || "1GfIWcOiJEj90Y7r_6CK8qmMrcq1lPyDi5kG0sjSWDnA"

export function getRedirectUri(): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) return process.env.GOOGLE_OAUTH_REDIRECT_URI
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) throw new Error("Falta NEXT_PUBLIC_SITE_URL o GOOGLE_OAUTH_REDIRECT_URI")
  return `${site.replace(/\/$/, "")}/api/google/callback`
}

export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET")
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri())
}

export function getAuthUrl(state: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  })
}

export interface ExchangedTokens {
  refreshToken: string | null
  accessToken: string | null
  expiryDate: number | null
  scope: string | null
  email: string | null
}

export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  let email: string | null = null
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client })
    const me = await oauth2.userinfo.get()
    email = me.data.email ?? null
  } catch {
    // no bloqueante
  }

  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null,
    email,
  }
}

/** Guarda/actualiza la credencial del usuario (refresh token cifrado). */
export async function saveCredencial(
  supabase: any,
  usuarioId: string,
  tokens: ExchangedTokens,
): Promise<void> {
  if (!tokens.refreshToken) {
    throw new Error(
      "Google no devolvió refresh_token. Revoca el acceso de la app en tu cuenta de Google y vuelve a conectar.",
    )
  }
  const row = {
    usuario_id: usuarioId,
    email: tokens.email,
    refresh_token_cifrado: encryptSecret(tokens.refreshToken),
    scope: tokens.scope,
    token_expiry: tokens.expiryDate ? new Date(tokens.expiryDate).toISOString() : null,
  }
  const { error } = await supabase
    .from("google_credencial")
    .upsert(row, { onConflict: "usuario_id" })
  if (error) throw error
}

/**
 * Devuelve un OAuth2Client autorizado para el usuario (con refresh token),
 * o null si no tiene credencial guardada.
 */
export async function getAuthorizedClient(
  supabase: any,
  usuarioId: string,
): Promise<OAuth2Client | null> {
  const { data, error } = await supabase
    .from("google_credencial")
    .select("refresh_token_cifrado")
    .eq("usuario_id", usuarioId)
    .maybeSingle()
  if (error || !data?.refresh_token_cifrado) return null

  const client = createOAuthClient()
  client.setCredentials({ refresh_token: decryptSecret(data.refresh_token_cifrado) })
  return client
}

export function getDrive(client: OAuth2Client) {
  return google.drive({ version: "v3", auth: client })
}

export function getSheets(client: OAuth2Client) {
  return google.sheets({ version: "v4", auth: client })
}
