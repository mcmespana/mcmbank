import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { verifyApiKey } from "@/lib/api/external-auth"

/**
 * Esta es la puerta de la API externa y del MCP, que trabajan con la clave de
 * servicio y se saltan la RLS: aquí un fallo no es un bug de UI, es acceso a
 * los datos de las 18 delegaciones. Cada regla del cuadro de permisos tiene su
 * caso.
 */

const ENV_KEYS = ["MCM_API_KEY", "MCM_API_KEY_READONLY", "CRON_SECRET"] as const
const original: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    original[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k]
    else process.env[k] = original[k]
  }
})

const req = (headers: Record<string, string> = {}) =>
  new Request("https://mcmbank.test/api/v1/movimientos", { headers })

describe("verifyApiKey · configuración del servidor", () => {
  it("sin ninguna clave configurada responde 500, no 401", () => {
    const res = verifyApiKey(req({ "x-api-key": "loquesea" }))
    expect(res).toMatchObject({ ok: false, status: 500 })
    if (!res.ok) expect(res.error).toContain("MCM_API_KEY")
  })
})

describe("verifyApiKey · cómo llega la clave", () => {
  beforeEach(() => {
    process.env.MCM_API_KEY = "clave-escritura"
  })

  it("acepta Authorization: Bearer", () => {
    expect(verifyApiKey(req({ authorization: "Bearer clave-escritura" }))).toEqual({
      ok: true,
      scope: "write",
      source: "MCM_API_KEY",
    })
  })

  it("acepta el esquema Bearer en cualquier caja", () => {
    expect(verifyApiKey(req({ authorization: "bEaReR clave-escritura" })).ok).toBe(true)
  })

  it("acepta la cabecera x-api-key", () => {
    expect(verifyApiKey(req({ "x-api-key": "clave-escritura" })).ok).toBe(true)
  })

  it("tolera espacios de más alrededor de la clave", () => {
    expect(verifyApiKey(req({ authorization: "Bearer   clave-escritura  " })).ok).toBe(true)
    expect(verifyApiKey(req({ "x-api-key": " clave-escritura " })).ok).toBe(true)
  })

  it("sin cabecera de clave responde 401 e indica cómo enviarla", () => {
    const res = verifyApiKey(req())
    expect(res).toMatchObject({ ok: false, status: 401 })
    if (!res.ok) expect(res.error).toContain("x-api-key")
  })

  it("una cabecera Authorization que no sea Bearer no cuela", () => {
    expect(verifyApiKey(req({ authorization: "Basic clave-escritura" }))).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it("una clave equivocada es 401", () => {
    expect(verifyApiKey(req({ "x-api-key": "otra-cosa" }))).toMatchObject({ ok: false, status: 401 })
  })

  it("un prefijo correcto de la clave no basta", () => {
    expect(verifyApiKey(req({ "x-api-key": "clave-escritu" }))).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it("distingue mayúsculas en la clave", () => {
    expect(verifyApiKey(req({ "x-api-key": "CLAVE-ESCRITURA" })).ok).toBe(false)
  })
})

describe("verifyApiKey · niveles de permiso", () => {
  it("la clave de solo lectura no puede escribir (403)", () => {
    process.env.MCM_API_KEY = "clave-escritura"
    process.env.MCM_API_KEY_READONLY = "clave-lectura"

    expect(verifyApiKey(req({ "x-api-key": "clave-lectura" }), "read")).toMatchObject({
      ok: true,
      scope: "read",
      source: "MCM_API_KEY_READONLY",
    })

    const res = verifyApiKey(req({ "x-api-key": "clave-lectura" }), "write")
    expect(res).toMatchObject({ ok: false, status: 403 })
    if (!res.ok) expect(res.error).toContain("solo lectura")
  })

  it("CRON_SECRET da lectura pero nunca escritura, y lo explica", () => {
    process.env.CRON_SECRET = "cron"
    expect(verifyApiKey(req({ "x-api-key": "cron" }), "read")).toMatchObject({
      ok: true,
      scope: "read",
      source: "CRON_SECRET",
    })

    const res = verifyApiKey(req({ "x-api-key": "cron" }), "write")
    expect(res).toMatchObject({ ok: false, status: 403 })
    if (!res.ok) expect(res.error).toContain("MCM_API_KEY")
  })

  it("la clave de escritura vale también para leer", () => {
    process.env.MCM_API_KEY = "clave-escritura"
    expect(verifyApiKey(req({ "x-api-key": "clave-escritura" }), "read").ok).toBe(true)
    expect(verifyApiKey(req({ "x-api-key": "clave-escritura" }), "write").ok).toBe(true)
  })

  it("por defecto se exige solo lectura", () => {
    process.env.MCM_API_KEY_READONLY = "clave-lectura"
    expect(verifyApiKey(req({ "x-api-key": "clave-lectura" })).ok).toBe(true)
  })

  it("si la misma clave está en dos variables, gana la de más permiso", () => {
    process.env.MCM_API_KEY = "misma"
    process.env.CRON_SECRET = "misma"
    expect(verifyApiKey(req({ "x-api-key": "misma" }), "write")).toMatchObject({
      ok: true,
      scope: "write",
    })
  })

  it("lee las variables en cada llamada, sin cachear el arranque", () => {
    process.env.MCM_API_KEY = "primera"
    expect(verifyApiKey(req({ "x-api-key": "primera" })).ok).toBe(true)

    process.env.MCM_API_KEY = "rotada"
    expect(verifyApiKey(req({ "x-api-key": "primera" })).ok).toBe(false)
    expect(verifyApiKey(req({ "x-api-key": "rotada" })).ok).toBe(true)
  })
})
