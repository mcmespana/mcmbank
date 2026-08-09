import { createHash, timingSafeEqual } from "node:crypto"

/**
 * PKCE (RFC 7636), método S256.
 *
 * Es la pieza que sostiene todo el flujo: los clientes son aplicaciones
 * públicas, sin secreto que guardar, así que lo único que demuestra que quien
 * canjea el código es quien lo pidió es haber elegido antes un `code_verifier`
 * y haber publicado su hash. Un código robado por el camino no sirve de nada
 * sin él.
 */

/** Comprueba que SHA-256(verifier) en base64url coincide con el challenge. */
export function verificarPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false

  const calculado = createHash("sha256").update(verifier).digest("base64url")
  const a = Buffer.from(calculado)
  const b = Buffer.from(challenge)

  // Longitudes distintas ⇒ no coinciden; `timingSafeEqual` además exige que
  // sean iguales para poder comparar en tiempo constante.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Genera el challenge de un verifier. Solo se usa en pruebas y ejemplos. */
export function challengeDe(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}
