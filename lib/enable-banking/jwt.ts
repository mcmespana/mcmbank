import crypto from "node:crypto"

// Cache en memoria del proceso. En dev/HMR se regenera; en prod Vercel el
// worker mantiene el JWT reutilizable hasta 23 horas.
let cache: { token: string; expiresAt: number } | null = null

const MAX_TTL_SECONDS = 23 * 60 * 60 // < 24h que es el máximo de EB
const REFRESH_MARGIN_SECONDS = 60

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function readConfig(): { appId: string; privateKey: string } {
  const appId = process.env.ENABLE_BANKING_APP_ID
  const rawKey = process.env.ENABLE_BANKING_PRIVATE_KEY
  if (!appId) throw new Error("ENABLE_BANKING_APP_ID no está configurado")
  if (!rawKey) throw new Error("ENABLE_BANKING_PRIVATE_KEY no está configurado")
  // Vercel guarda secretos multilínea como \n literal. Normalizamos.
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey
  return { appId, privateKey }
}

export function generateEnableBankingJWT(): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000)
  if (cache && cache.expiresAt - now > REFRESH_MARGIN_SECONDS) {
    return cache
  }

  const { appId, privateKey } = readConfig()
  const expiresAt = now + MAX_TTL_SECONDS

  const header = { typ: "JWT", alg: "RS256", kid: appId }
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: expiresAt,
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  const signature = base64url(signer.sign(privateKey))

  const token = `${signingInput}.${signature}`
  cache = { token, expiresAt }
  return cache
}

/** Solo para debug — fingerprint sha256 de la clave pública derivada. */
export function privateKeyFingerprint(): string {
  try {
    const { privateKey } = readConfig()
    const keyObj = crypto.createPrivateKey(privateKey)
    const pubPem = crypto.createPublicKey(keyObj).export({ type: "spki", format: "pem" }) as string
    return crypto.createHash("sha256").update(pubPem).digest("hex").slice(0, 16)
  } catch {
    return "unavailable"
  }
}

export function resetJwtCache(): void {
  cache = null
}
