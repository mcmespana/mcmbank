import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Integración con Google (Drive/Sheets) vía OAuth2 por usuario. Lo que
 * importa no es que `googleapis` funcione, sino: a qué dominio vuelve el
 * callback (tiene que ser el mismo en el que está el usuario, o el state y
 * la cookie no casan), que sin refresh_token no se guarde una credencial
 * inútil, y que el refresh token viaje siempre cifrado — nunca en claro —
 * hacia y desde la base de datos.
 */

const generateAuthUrl = vi.fn(() => "https://accounts.google.com/o/oauth2/auth?mock=1")
const getToken = vi.fn()
const setCredentials = vi.fn()

class OAuth2Falso {
  clientId: string
  clientSecret: string
  redirectUri?: string
  constructor(clientId: string, clientSecret: string, redirectUri?: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = redirectUri
  }
  generateAuthUrl = generateAuthUrl
  getToken = getToken
  setCredentials = setCredentials
}

const oauth2Factory = vi.fn()
const driveFactory = vi.fn(() => "cliente-drive")
const sheetsFactory = vi.fn(() => "cliente-sheets")

vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: OAuth2Falso },
    oauth2: oauth2Factory,
    drive: driveFactory,
    sheets: sheetsFactory,
  },
}))

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_CLIENT_ID = "client-id-de-prueba"
  process.env.GOOGLE_CLIENT_SECRET = "client-secret-de-prueba"
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "una-clave-de-prueba"
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI
  delete process.env.NEXT_PUBLIC_SITE_URL
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
})

function req(headers: Record<string, string>, url = "https://ignorado.example/api/google/start") {
  return new Request(url, { headers })
}

describe("originFromRequest", () => {
  it("usa x-forwarded-host y x-forwarded-proto (el dominio real detrás del proxy de Vercel)", async () => {
    const { originFromRequest } = await import("@/lib/services/google")
    const origen = originFromRequest(
      req({ "x-forwarded-host": "banco.movimientoconsolacion.com", "x-forwarded-proto": "https" }),
    )
    expect(origen).toBe("https://banco.movimientoconsolacion.com")
  })

  it("sin x-forwarded-proto, asume https", async () => {
    const { originFromRequest } = await import("@/lib/services/google")
    const origen = originFromRequest(req({ "x-forwarded-host": "banco.movimientoconsolacion.com" }))
    expect(origen).toBe("https://banco.movimientoconsolacion.com")
  })

  it("sin cabeceras de proxy, cae al header host", async () => {
    const { originFromRequest } = await import("@/lib/services/google")
    expect(originFromRequest(req({ host: "localhost:3000" }))).toBe("https://localhost:3000")
  })

  it("sin ninguna cabecera, usa el origin de la propia URL", async () => {
    const { originFromRequest } = await import("@/lib/services/google")
    expect(originFromRequest(req({}, "https://fallback.example/x"))).toBe("https://fallback.example")
  })
})

describe("getRedirectUri", () => {
  it("con origin, construye la ruta del callback sobre ese dominio", async () => {
    const { getRedirectUri } = await import("@/lib/services/google")
    expect(getRedirectUri("https://banco.movimientoconsolacion.com/")).toBe(
      "https://banco.movimientoconsolacion.com/api/google/callback",
    )
  })

  it("sin origin, usa GOOGLE_OAUTH_REDIRECT_URI si está definida", async () => {
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://fijo.example/callback"
    const { getRedirectUri } = await import("@/lib/services/google")
    expect(getRedirectUri()).toBe("https://fijo.example/callback")
  })

  it("sin origin ni override, cae a NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://banco.movimientoconsolacion.com/"
    const { getRedirectUri } = await import("@/lib/services/google")
    expect(getRedirectUri()).toBe("https://banco.movimientoconsolacion.com/api/google/callback")
  })

  it("sin nada configurado, devuelve una cadena vacía (válido para refrescar token)", async () => {
    const { getRedirectUri } = await import("@/lib/services/google")
    expect(getRedirectUri()).toBe("")
  })
})

describe("createOAuthClient", () => {
  it("sin credenciales de Google configuradas, falla con un mensaje claro", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const { createOAuthClient } = await import("@/lib/services/google")
    expect(() => createOAuthClient()).toThrow("GOOGLE_CLIENT_ID")
  })

  it("construye el cliente con el client id/secret y el redirect_uri resuelto", async () => {
    const { createOAuthClient } = await import("@/lib/services/google")
    const cliente = createOAuthClient("https://x.example/callback") as unknown as OAuth2Falso
    expect(cliente.clientId).toBe("client-id-de-prueba")
    expect(cliente.redirectUri).toBe("https://x.example/callback")
  })
})

describe("getAuthUrl", () => {
  it("pide acceso offline y consentimiento, con los scopes y el state", async () => {
    const { getAuthUrl, GOOGLE_SCOPES } = await import("@/lib/services/google")
    getAuthUrl("un-state-cualquiera", "https://x.example/callback")
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        scope: GOOGLE_SCOPES,
        state: "un-state-cualquiera",
        include_granted_scopes: true,
      }),
    )
  })

  it("con forceSelectAccount, añade select_account al prompt", async () => {
    const { getAuthUrl } = await import("@/lib/services/google")
    getAuthUrl("s", undefined, true)
    expect(generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({ prompt: "select_account consent" }))
  })
})

describe("exchangeCode", () => {
  it("canjea el código y trae el email del usuario", async () => {
    getToken.mockResolvedValue({
      tokens: {
        refresh_token: "un-refresh-token",
        access_token: "un-access-token",
        expiry_date: 1234567890,
        scope: "drive sheets",
      },
    })
    oauth2Factory.mockReturnValue({ userinfo: { get: vi.fn().mockResolvedValue({ data: { email: "a@b.com" } }) } })

    const { exchangeCode } = await import("@/lib/services/google")
    const resultado = await exchangeCode("codigo-de-autorizacion")

    expect(setCredentials).toHaveBeenCalled()
    expect(resultado).toEqual({
      refreshToken: "un-refresh-token",
      accessToken: "un-access-token",
      expiryDate: 1234567890,
      scope: "drive sheets",
      email: "a@b.com",
    })
  })

  it("si falla obtener el email, no revienta: sigue con email null", async () => {
    getToken.mockResolvedValue({ tokens: { refresh_token: "x" } })
    oauth2Factory.mockReturnValue({ userinfo: { get: vi.fn().mockRejectedValue(new Error("403")) } })

    const { exchangeCode } = await import("@/lib/services/google")
    const resultado = await exchangeCode("codigo")
    expect(resultado.email).toBeNull()
    expect(resultado.refreshToken).toBe("x")
  })

  it("sin ninguno de los campos, todos salen null en vez de undefined", async () => {
    getToken.mockResolvedValue({ tokens: {} })
    oauth2Factory.mockReturnValue({ userinfo: { get: vi.fn().mockResolvedValue({ data: {} }) } })

    const { exchangeCode } = await import("@/lib/services/google")
    const resultado = await exchangeCode("codigo")
    expect(resultado).toEqual({
      refreshToken: null,
      accessToken: null,
      expiryDate: null,
      scope: null,
      email: null,
    })
  })
})

describe("saveCredencial / getAuthorizedClient · el refresh token siempre cifrado", () => {
  function tablas(extra: Partial<Tablas> = {}): Tablas {
    return { google_credencial: [], ...extra }
  }

  it("sin refresh_token, se rechaza antes de guardar nada (pedirlo obligaría a reconectar sin motivo)", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    const { saveCredencial } = await import("@/lib/services/google")
    await expect(
      saveCredencial(admin, "user-1", {
        refreshToken: null,
        accessToken: "x",
        expiryDate: null,
        scope: null,
        email: null,
      }),
    ).rejects.toThrow("refresh_token")
    expect(admin.tablas.google_credencial).toHaveLength(0)
  })

  it("guarda el refresh token cifrado, nunca en claro", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    const { saveCredencial } = await import("@/lib/services/google")
    await saveCredencial(admin, "user-1", {
      refreshToken: "token-secreto-de-google",
      accessToken: "x",
      expiryDate: 1700000000000,
      scope: "drive",
      email: "a@b.com",
    })

    const fila = admin.tablas.google_credencial[0]
    expect(fila.refresh_token_cifrado).not.toContain("token-secreto-de-google")
    expect(fila.usuario_id).toBe("user-1")
    expect(fila.token_expiry).toBe(new Date(1700000000000).toISOString())
  })

  it("guardar dos veces para el mismo usuario actualiza la credencial, no la duplica", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    const { saveCredencial } = await import("@/lib/services/google")
    const tokens = (rt: string) => ({ refreshToken: rt, accessToken: null, expiryDate: null, scope: null, email: null })

    await saveCredencial(admin, "user-1", tokens("primero"))
    await saveCredencial(admin, "user-1", tokens("segundo"))

    expect(admin.tablas.google_credencial).toHaveLength(1)
  })

  it("getAuthorizedClient sin credencial guardada devuelve null", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    const { getAuthorizedClient } = await import("@/lib/services/google")
    expect(await getAuthorizedClient(admin, "user-sin-credencial")).toBeNull()
  })

  it("getAuthorizedClient descifra el token guardado y lo pone en el cliente", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    const { saveCredencial, getAuthorizedClient } = await import("@/lib/services/google")
    await saveCredencial(admin, "user-1", {
      refreshToken: "token-secreto-de-google",
      accessToken: null,
      expiryDate: null,
      scope: null,
      email: null,
    })

    const cliente = await getAuthorizedClient(admin, "user-1")
    expect(cliente).not.toBeNull()
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: "token-secreto-de-google" })
  })
})

describe("getDrive / getSheets", () => {
  it("delegan en googleapis con el cliente autorizado", async () => {
    const { getDrive, getSheets } = await import("@/lib/services/google")
    const cliente = { fake: true } as any
    expect(getDrive(cliente)).toBe("cliente-drive")
    expect(driveFactory).toHaveBeenCalledWith({ version: "v3", auth: cliente })
    expect(getSheets(cliente)).toBe("cliente-sheets")
    expect(sheetsFactory).toHaveBeenCalledWith({ version: "v4", auth: cliente })
  })
})
