import crypto from "crypto"

/**
 * Cifrado simétrico AES-256-GCM para secretos en reposo (refresh tokens de Google).
 * La clave se toma de GOOGLE_TOKEN_ENCRYPTION_KEY (hex de 64 chars / 32 bytes,
 * o cualquier cadena, que se normaliza con sha256).
 */
function getKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("Falta GOOGLE_TOKEN_ENCRYPTION_KEY en el entorno")
  }
  // Si es hex de 32 bytes, úsalo tal cual; si no, deriva con sha256.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }
  return crypto.createHash("sha256").update(raw).digest()
}

/** Devuelve "iv:authTag:ciphertext" en base64. */
export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":")
}

export function decryptSecret(payload: string): string {
  const key = getKey()
  const [ivB64, tagB64, dataB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de secreto cifrado inválido")
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}
