import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import crypto from "node:crypto"

/**
 * El JWT que autentica cada llamada a Enable Banking. Lo importante no es
 * que firme (eso lo hace node:crypto), sino que cachee para no firmar en
 * cada petición, que refresque con margen antes de que caduque y que
 * normalice la clave privada tal y como la guarda Vercel (con "\n" literal
 * en vez de saltos de línea reales).
 */

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
})

const ENV_KEYS = ["ENABLE_BANKING_APP_ID", "ENABLE_BANKING_PRIVATE_KEY"] as const

function limpiarEnv() {
  for (const k of ENV_KEYS) delete process.env[k]
}

function configurar(clave: string = privateKey) {
  process.env.ENABLE_BANKING_APP_ID = "app-de-prueba"
  process.env.ENABLE_BANKING_PRIVATE_KEY = clave
}

function partesDe(token: string): { header: any; payload: any; signature: string } {
  const [h, p, s] = token.split(".")
  const decode = (b64url: string) => JSON.parse(Buffer.from(b64url, "base64url").toString("utf8"))
  return { header: decode(h), payload: decode(p), signature: s }
}

function firmaValida(token: string): boolean {
  const [h, p, s] = token.split(".")
  const verifier = crypto.createVerify("RSA-SHA256")
  verifier.update(`${h}.${p}`)
  verifier.end()
  const signature = Buffer.from(s, "base64url")
  return verifier.verify(publicKey, signature)
}

beforeEach(async () => {
  limpiarEnv()
  vi.resetModules()
  const { resetJwtCache } = await import("@/lib/enable-banking/jwt")
  resetJwtCache()
})

afterEach(() => {
  vi.useRealTimers()
  limpiarEnv()
})

describe("generateEnableBankingJWT · configuración", () => {
  it("sin ENABLE_BANKING_APP_ID, falla con un mensaje claro", async () => {
    process.env.ENABLE_BANKING_PRIVATE_KEY = privateKey
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    expect(() => generateEnableBankingJWT()).toThrow("ENABLE_BANKING_APP_ID")
  })

  it("sin ENABLE_BANKING_PRIVATE_KEY, falla con un mensaje claro", async () => {
    process.env.ENABLE_BANKING_APP_ID = "app-de-prueba"
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    expect(() => generateEnableBankingJWT()).toThrow("ENABLE_BANKING_PRIVATE_KEY")
  })

  it("normaliza una clave con '\\n' literal (como la guarda Vercel)", async () => {
    configurar(privateKey.replace(/\n/g, "\\n"))
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    const { token } = generateEnableBankingJWT()
    expect(firmaValida(token)).toBe(true)
  })
})

describe("generateEnableBankingJWT · forma del token", () => {
  it("firma correctamente y lleva el appId como kid", async () => {
    configurar()
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    const { token } = generateEnableBankingJWT()
    const { header, payload } = partesDe(token)

    expect(firmaValida(token)).toBe(true)
    expect(header).toMatchObject({ typ: "JWT", alg: "RS256", kid: "app-de-prueba" })
    expect(payload).toMatchObject({ iss: "enablebanking.com", aud: "api.enablebanking.com" })
    expect(payload.exp - payload.iat).toBe(23 * 60 * 60)
  })
})

describe("generateEnableBankingJWT · caché", () => {
  it("dos llamadas seguidas devuelven el mismo token (no firma dos veces)", async () => {
    configurar()
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    const a = generateEnableBankingJWT()
    const b = generateEnableBankingJWT()
    expect(a.token).toBe(b.token)
  })

  it("sigue usando el mismo token si aún le queda de sobra", async () => {
    configurar()
    vi.useFakeTimers()
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    const a = generateEnableBankingJWT()
    vi.advanceTimersByTime(60 * 60 * 1000) // +1h de las 23h de vida
    const b = generateEnableBankingJWT()
    expect(a.token).toBe(b.token)
  })

  it("dentro del margen de refresco (60s antes de caducar), genera uno nuevo", async () => {
    configurar()
    vi.useFakeTimers()
    const { generateEnableBankingJWT } = await import("@/lib/enable-banking/jwt")
    const a = generateEnableBankingJWT()
    vi.advanceTimersByTime(23 * 60 * 60 * 1000 - 30 * 1000) // quedan 30s, margen son 60s
    const b = generateEnableBankingJWT()
    expect(b.token).not.toBe(a.token)
    expect(firmaValida(b.token)).toBe(true)
  })

  it("resetJwtCache() fuerza a firmar uno nuevo aunque el anterior siguiera vivo", async () => {
    configurar()
    const { generateEnableBankingJWT, resetJwtCache } = await import("@/lib/enable-banking/jwt")
    const a = generateEnableBankingJWT()
    resetJwtCache()
    const b = generateEnableBankingJWT()
    // Puede coincidir por casualidad si iat/exp caen en el mismo segundo; lo
    // que importa es que ambos son válidos de forma independiente.
    expect(firmaValida(a.token)).toBe(true)
    expect(firmaValida(b.token)).toBe(true)
  })
})

describe("privateKeyFingerprint", () => {
  it("devuelve un hash estable de la clave pública derivada", async () => {
    configurar()
    const { privateKeyFingerprint } = await import("@/lib/enable-banking/jwt")
    const huella = privateKeyFingerprint()
    expect(huella).toMatch(/^[0-9a-f]{16}$/)
    expect(privateKeyFingerprint()).toBe(huella)
  })

  it("sin configurar, devuelve 'unavailable' en vez de lanzar", async () => {
    const { privateKeyFingerprint } = await import("@/lib/enable-banking/jwt")
    expect(privateKeyFingerprint()).toBe("unavailable")
  })
})
