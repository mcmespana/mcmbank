import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encryptSecret, decryptSecret } from "@/lib/services/crypto"

/**
 * Cifrado de los refresh tokens de Google en reposo (AES-256-GCM). Lo que
 * importa no es que AES funcione (eso lo garantiza node:crypto), sino que un
 * secreto vaya y vuelva igual, que dos cifrados del mismo texto no se parezcan
 * (IV aleatorio) y que un ciphertext manipulado falle en vez de devolver
 * basura silenciosamente — GCM es de cifrado autenticado justo para eso.
 */

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "una-clave-de-prueba-cualquiera"
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
})

describe("encryptSecret / decryptSecret", () => {
  it("round-trip: lo que se cifra se descifra igual", () => {
    const original = "refresh-token-de-google-muy-secreto"
    expect(decryptSecret(encryptSecret(original))).toBe(original)
  })

  it("cifrar el mismo texto dos veces da resultados distintos (IV aleatorio)", () => {
    const a = encryptSecret("mismo-texto")
    const b = encryptSecret("mismo-texto")
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe("mismo-texto")
    expect(decryptSecret(b)).toBe("mismo-texto")
  })

  it("acepta una clave hex de 64 caracteres directamente, sin derivar", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "a".repeat(64)
    const original = "secreto"
    expect(decryptSecret(encryptSecret(original))).toBe(original)
  })

  it("un ciphertext manipulado no se descifra en silencio: falla", () => {
    const cifrado = encryptSecret("dato sensible")
    const [iv, tag, datos] = cifrado.split(":")
    const datosManipulados = Buffer.from(datos, "base64")
    datosManipulados[0] ^= 0xff
    const manipulado = [iv, tag, datosManipulados.toString("base64")].join(":")
    expect(() => decryptSecret(manipulado)).toThrow()
  })

  it("un authTag que no corresponde también falla, no solo el ciphertext", () => {
    const cifrado = encryptSecret("dato sensible")
    const [iv, , datos] = cifrado.split(":")
    const tagFalso = Buffer.alloc(16).toString("base64")
    expect(() => decryptSecret([iv, tagFalso, datos].join(":"))).toThrow()
  })

  it("un formato sin las tres partes esperadas falla con un mensaje claro", () => {
    expect(() => decryptSecret("solo-una-parte")).toThrow("Formato")
  })

  it("sin GOOGLE_TOKEN_ENCRYPTION_KEY configurada, falla al cifrar y al descifrar", () => {
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
    expect(() => encryptSecret("x")).toThrow("GOOGLE_TOKEN_ENCRYPTION_KEY")
    expect(() => decryptSecret("a:b:c")).toThrow("GOOGLE_TOKEN_ENCRYPTION_KEY")
  })

  it("descifrar con una clave distinta a la usada para cifrar falla", () => {
    const cifrado = encryptSecret("secreto")
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "otra-clave-completamente-distinta"
    expect(() => decryptSecret(cifrado)).toThrow()
  })
})
