import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Puerta de entrada del servidor MCP: clave de API u OAuth, nunca las dos
 * cosas a la vez decidiendo quién firma.
 *
 * Lo importante de `autorizarMcp` no es "deja pasar o no", sino qué lleva
 * cada camino: con OAuth el usuario del token manda siempre
 * (`actorForzado`) y no se admite ninguna pista de autoría, precisamente
 * para que el modelo no pueda firmar en nombre de otra persona; con clave de
 * API la autoría es solo una pista porque la clave no es una persona.
 */

vi.mock("@/lib/oauth/store", () => ({
  validarAccessToken: vi.fn(),
}))

const ENV_KEYS = ["MCM_API_KEY", "MCM_API_KEY_READONLY", "CRON_SECRET"] as const

function limpiarEnv() {
  for (const k of ENV_KEYS) delete process.env[k]
}

function req(headers: Record<string, string> = {}) {
  return new Request("https://banco.movimientoconsolacion.com/api/mcp", { headers })
}

beforeEach(() => {
  limpiarEnv()
  vi.resetModules()
  vi.clearAllMocks()
})

describe("autorizarMcp · sin credencial", () => {
  it("rechaza con 401 y un desafío WWW-Authenticate si no llega ninguna credencial", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const { autorizarMcp } = await import("@/lib/mcp/auth")
    const resultado = await autorizarMcp(req())
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.rechazo.status).toBe(401)
      expect(resultado.rechazo.cabeceras["WWW-Authenticate"]).toContain("resource_metadata=")
    }
  })
})

describe("autorizarMcp · clave de API", () => {
  it("una clave de escritura válida autoriza con scope write, sin actor forzado", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const { autorizarMcp } = await import("@/lib/mcp/auth")
    const resultado = await autorizarMcp(req({ authorization: "Bearer clave-secreta" }))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.auth.scope).toBe("write")
      expect(resultado.auth.via).toBe("clave")
      expect(resultado.auth.actorForzado).toBeNull()
    }
  })

  it("recoge la pista de autoría de la cabecera x-mcm-usuario-email", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const { autorizarMcp } = await import("@/lib/mcp/auth")
    const resultado = await autorizarMcp(
      req({ authorization: "Bearer clave-secreta", "x-mcm-usuario-email": "admin@movimientoconsolacion.com" }),
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.auth.actorHint.usuario_email).toBe("admin@movimientoconsolacion.com")
    }
  })

  it("no llega a comprobar el token OAuth si la clave de API ya vale (no toca red)", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const store = await import("@/lib/oauth/store")
    const { autorizarMcp } = await import("@/lib/mcp/auth")
    await autorizarMcp(req({ authorization: "Bearer clave-secreta" }))
    expect(store.validarAccessToken).not.toHaveBeenCalled()
  })

  it("una clave de solo lectura no pasa por OAuth y da scope read", async () => {
    process.env.MCM_API_KEY_READONLY = "clave-lectura"
    const { autorizarMcp } = await import("@/lib/mcp/auth")
    const resultado = await autorizarMcp(req({ "x-api-key": "clave-lectura" }))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.auth.scope).toBe("read")
  })
})

describe("autorizarMcp · token OAuth", () => {
  it("un token OAuth válido con scope de escritura fuerza al usuario del token como autor", async () => {
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockResolvedValue({
      usuarioId: "user-123",
      clientId: "mcm-cliente",
      scopes: ["mcm:read", "mcm:write"],
      resource: null,
    })
    process.env.MCM_API_KEY = "otra-clave-que-no-se-usa-aqui"
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(req({ authorization: "Bearer token-oauth-valido" }))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.auth.via).toBe("oauth")
      expect(resultado.auth.scope).toBe("write")
      // Con OAuth el actor no es una pista: es una obligación.
      expect(resultado.auth.actorForzado).toBe("user-123")
      expect(resultado.auth.actorHint).toEqual({ usuario_id: "user-123" })
    }
  })

  it("un token OAuth con solo permiso de lectura da scope read", async () => {
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockResolvedValue({
      usuarioId: "user-123",
      clientId: "mcm-cliente",
      scopes: ["mcm:read"],
      resource: null,
    })
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(req({ authorization: "Bearer token-de-solo-lectura" }))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.auth.scope).toBe("read")
  })

  it("una cabecera x-mcm-usuario-email no puede suplantar al usuario del token OAuth", async () => {
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockResolvedValue({
      usuarioId: "user-real",
      clientId: "mcm-cliente",
      scopes: ["mcm:read"],
      resource: null,
    })
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(
      req({ authorization: "Bearer token-oauth", "x-mcm-usuario-email": "otro@ejemplo.com" }),
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.auth.actorForzado).toBe("user-real")
      expect(resultado.auth.actorHint).toEqual({ usuario_id: "user-real" })
    }
  })
})

describe("autorizarMcp · credencial inválida", () => {
  it("si no es ni una clave conocida ni un token OAuth vivo, 401 con desafío", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockResolvedValue(null)
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(req({ authorization: "Bearer algo-que-no-es-nada" }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.rechazo.status).toBe(401)
      expect(resultado.rechazo.cabeceras["WWW-Authenticate"]).toContain("invalid_token")
    }
  })

  it("si el servidor no tiene ninguna clave configurada, se distingue como 500 (fallo de despliegue)", async () => {
    // Sin MCM_API_KEY/MCM_API_KEY_READONLY/CRON_SECRET.
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockResolvedValue(null)
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(req({ authorization: "Bearer lo-que-sea" }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.rechazo.status).toBe(500)
  })

  it("si la base de datos falla al validar el token, es un 503 y no un 401", async () => {
    process.env.MCM_API_KEY = "clave-secreta"
    const store = await import("@/lib/oauth/store")
    vi.mocked(store.validarAccessToken).mockRejectedValue(new Error("timeout de red"))
    const { autorizarMcp } = await import("@/lib/mcp/auth")

    const resultado = await autorizarMcp(req({ authorization: "Bearer token-cualquiera" }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.rechazo.status).toBe(503)
  })
})
