import { describe, it, expect, beforeEach, vi } from "vitest"
import { createHash } from "node:crypto"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"
import { challengeDe } from "@/lib/oauth/pkce"
import { SCOPES } from "@/lib/oauth/config"

/**
 * Ciclo de vida de códigos y tokens OAuth.
 *
 * Lo que se prueba aquí son justo los invariantes de seguridad que
 * CLAUDE.md promete y que no puede garantizar Postgres por sí solo: un
 * código de autorización se canjea una sola vez, un token de refresco rota
 * en cada uso, y reutilizar cualquiera de los dos (señal de que se ha
 * filtrado) cierra todas las sesiones de ese cliente+usuario en vez de
 * limitarse a rechazar la petición.
 */

let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeAdmin,
}))

function hash(valor: string): string {
  return createHash("sha256").update(valor).digest("hex")
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    mcp_oauth_cliente: [],
    mcp_oauth_codigo: [],
    mcp_oauth_token: [],
    ...extra,
  }
}

const CLIENT_ID = "mcm-cliente-1"
const OTRO_CLIENT_ID = "mcm-cliente-2"
const USUARIO_ID = "11111111-1111-1111-1111-111111111111"
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback"
const VERIFIER = "un-verifier-suficientemente-largo-y-aleatorio"
const CHALLENGE = challengeDe(VERIFIER)

beforeEach(() => {
  fakeAdmin = crearFakeAdmin(tablas())
})

describe("redirectUriAceptable", () => {
  it("acepta https y http en localhost, rechaza http externo y esquemas peligrosos", async () => {
    const { redirectUriAceptable } = await import("@/lib/oauth/store")
    expect(redirectUriAceptable("https://claude.ai/cb")).toBe(true)
    expect(redirectUriAceptable("http://localhost:3000/cb")).toBe(true)
    expect(redirectUriAceptable("http://atacante.example/cb")).toBe(false)
    expect(redirectUriAceptable("javascript:alert(1)")).toBe(false)
  })
})

describe("registrarCliente / obtenerCliente / redirectUriRegistrada", () => {
  it("registra un cliente y lo puede volver a leer por su client_id", async () => {
    const { registrarCliente, obtenerCliente } = await import("@/lib/oauth/store")
    const cliente = await registrarCliente({ nombre: "claude.ai", redirectUris: [REDIRECT_URI] })
    expect(cliente.client_id).toMatch(/^mcm-/)

    const leido = await obtenerCliente(cliente.client_id)
    expect(leido).toMatchObject({ nombre: "claude.ai", redirect_uris: [REDIRECT_URI] })
  })

  it("obtenerCliente devuelve null si no existe, sin lanzar", async () => {
    const { obtenerCliente } = await import("@/lib/oauth/store")
    expect(await obtenerCliente("mcm-no-existe")).toBeNull()
  })

  it("redirectUriRegistrada exige coincidencia exacta", async () => {
    const { redirectUriRegistrada } = await import("@/lib/oauth/store")
    const cliente = {
      client_id: CLIENT_ID,
      nombre: "x",
      redirect_uris: [REDIRECT_URI],
      creado_en: "2026-01-01T00:00:00Z",
    }
    expect(redirectUriRegistrada(cliente, REDIRECT_URI)).toBe(true)
    expect(redirectUriRegistrada(cliente, `${REDIRECT_URI}/`)).toBe(false)
  })
})

describe("crearCodigo / canjearCodigo", () => {
  async function crear() {
    const { crearCodigo } = await import("@/lib/oauth/store")
    return crearCodigo({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      redirectUri: REDIRECT_URI,
      codeChallenge: CHALLENGE,
      scopes: [SCOPES.LEER, SCOPES.ESCRIBIR],
      resource: null,
    })
  }

  it("solo guarda el hash del código, nunca el código en claro", async () => {
    const codigo = await crear()
    const fila = fakeAdmin.tablas.mcp_oauth_codigo[0]
    expect(fila.codigo_hash).toBe(hash(codigo))
    expect(JSON.stringify(fila)).not.toContain(codigo)
  })

  it("canjea un código válido y devuelve cliente, usuario y scopes", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    const codigo = await crear()

    const resultado = await canjearCodigo({
      codigo,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      codeVerifier: VERIFIER,
    })

    expect(resultado).toMatchObject({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scopes: `${SCOPES.LEER} ${SCOPES.ESCRIBIR}`,
    })
    expect(fakeAdmin.tablas.mcp_oauth_codigo[0].usado_en).not.toBeNull()
  })

  it("un código inexistente da invalid_grant", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    await expect(
      canjearCodigo({
        codigo: "no-existe",
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("es de un solo uso: la segunda vez revoca todos los tokens de ese cliente+usuario", async () => {
    const { canjearCodigo, emitirTokens, validarAccessToken } = await import("@/lib/oauth/store")
    const codigo = await crear()
    await canjearCodigo({ codigo, clientId: CLIENT_ID, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })

    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    expect(await validarAccessToken(tokens.accessToken)).not.toBeNull()

    await expect(
      canjearCodigo({ codigo, clientId: CLIENT_ID, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })

    // El token emitido tras el primer canje también queda revocado: la
    // reutilización huele a código filtrado, así que se cierra todo.
    expect(await validarAccessToken(tokens.accessToken)).toBeNull()
  })

  it("un código caducado se rechaza", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    const codigo = await crear()
    fakeAdmin.tablas.mcp_oauth_codigo[0].expira_en = "2000-01-01T00:00:00Z"

    await expect(
      canjearCodigo({ codigo, clientId: CLIENT_ID, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("rechaza si el client_id no coincide", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    const codigo = await crear()
    await expect(
      canjearCodigo({ codigo, clientId: OTRO_CLIENT_ID, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("rechaza si la redirect_uri no es la que se usó al autorizar", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    const codigo = await crear()
    await expect(
      canjearCodigo({
        codigo,
        clientId: CLIENT_ID,
        redirectUri: "https://otro-destino.example/cb",
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("rechaza un code_verifier que no corresponde al challenge (PKCE)", async () => {
    const { canjearCodigo } = await import("@/lib/oauth/store")
    const codigo = await crear()
    await expect(
      canjearCodigo({
        codigo,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        codeVerifier: "verifier-equivocado",
      }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
    // Y el código sigue sin canjear: se puede reintentar con el verifier bueno.
    expect(fakeAdmin.tablas.mcp_oauth_codigo[0].usado_en).toBeFalsy()
  })
})

describe("validarAccessToken", () => {
  it("valida un access token vivo y separa los scopes", async () => {
    const { emitirTokens, validarAccessToken } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: `${SCOPES.LEER} ${SCOPES.ESCRIBIR}`,
      resource: null,
    })

    const valido = await validarAccessToken(tokens.accessToken)
    expect(valido).toMatchObject({
      usuarioId: USUARIO_ID,
      clientId: CLIENT_ID,
      scopes: [SCOPES.LEER, SCOPES.ESCRIBIR],
    })
  })

  it("un token desconocido no vale", async () => {
    const { validarAccessToken } = await import("@/lib/oauth/store")
    expect(await validarAccessToken("token-inventado")).toBeNull()
  })

  it("una cadena vacía no vale (y no llega a consultar nada)", async () => {
    const { validarAccessToken } = await import("@/lib/oauth/store")
    expect(await validarAccessToken("")).toBeNull()
  })

  it("un refresh token no sirve como access token", async () => {
    const { emitirTokens, validarAccessToken } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    expect(await validarAccessToken(tokens.refreshToken)).toBeNull()
  })

  it("un token expirado no vale", async () => {
    const { emitirTokens, validarAccessToken } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    const fila = fakeAdmin.tablas.mcp_oauth_token.find((f) => f.token_hash === hash(tokens.accessToken))!
    fila.expira_en = "2000-01-01T00:00:00Z"
    expect(await validarAccessToken(tokens.accessToken)).toBeNull()
  })

  it("un token revocado no vale", async () => {
    const { emitirTokens, validarAccessToken, revocarToken } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    await revocarToken(tokens.accessToken)
    expect(await validarAccessToken(tokens.accessToken)).toBeNull()
  })
})

describe("refrescarTokens", () => {
  it("rota el refresco: el viejo queda revocado y se emite uno nuevo", async () => {
    const { emitirTokens, refrescarTokens, validarAccessToken } = await import("@/lib/oauth/store")
    const primeros = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: `${SCOPES.LEER} ${SCOPES.ESCRIBIR}`,
      resource: null,
    })

    const nuevos = await refrescarTokens({
      refreshToken: primeros.refreshToken,
      clientId: CLIENT_ID,
      scopePedido: null,
    })

    expect(nuevos.refreshToken).not.toBe(primeros.refreshToken)
    expect(await validarAccessToken(nuevos.accessToken)).not.toBeNull()

    const filaVieja = fakeAdmin.tablas.mcp_oauth_token.find((f) => f.token_hash === hash(primeros.refreshToken))!
    expect(filaVieja.revocado_en).not.toBeNull()
  })

  it("reutilizar un refresh token ya rotado revoca toda la sesión", async () => {
    const { emitirTokens, refrescarTokens } = await import("@/lib/oauth/store")
    const primeros = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    const nuevos = await refrescarTokens({
      refreshToken: primeros.refreshToken,
      clientId: CLIENT_ID,
      scopePedido: null,
    })

    await expect(
      refrescarTokens({ refreshToken: primeros.refreshToken, clientId: CLIENT_ID, scopePedido: null }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })

    // El token nuevo, emitido en el primer refresco, también cae.
    const filaNueva = fakeAdmin.tablas.mcp_oauth_token.find((f) => f.token_hash === hash(nuevos.accessToken))!
    expect(filaNueva.revocado_en).not.toBeNull()
  })

  it("un refresh token caducado se rechaza", async () => {
    const { emitirTokens, refrescarTokens } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    const fila = fakeAdmin.tablas.mcp_oauth_token.find((f) => f.token_hash === hash(tokens.refreshToken))!
    fila.expira_en = "2000-01-01T00:00:00Z"

    await expect(
      refrescarTokens({ refreshToken: tokens.refreshToken, clientId: CLIENT_ID, scopePedido: null }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("un refresh token de otro cliente no vale", async () => {
    const { emitirTokens, refrescarTokens } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    await expect(
      refrescarTokens({ refreshToken: tokens.refreshToken, clientId: OTRO_CLIENT_ID, scopePedido: null }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_grant" })
  })

  it("puede pedir menos permisos de los concedidos, nunca más", async () => {
    const { emitirTokens, refrescarTokens } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })

    const nuevos = await refrescarTokens({
      refreshToken: tokens.refreshToken,
      clientId: CLIENT_ID,
      scopePedido: `${SCOPES.LEER} ${SCOPES.ESCRIBIR}`,
    })
    // Solo se concedía LEER: pedir además ESCRIBIR no lo consigue.
    expect(nuevos.scope).toBe(SCOPES.LEER)
  })

  it("si de lo pedido no queda nada concedido, error invalid_scope", async () => {
    const { emitirTokens, refrescarTokens } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })

    await expect(
      refrescarTokens({ refreshToken: tokens.refreshToken, clientId: CLIENT_ID, scopePedido: SCOPES.ESCRIBIR }),
    ).rejects.toMatchObject({ codigoOAuth: "invalid_scope" })
  })
})

describe("revocarToken / revocarTokensDe", () => {
  it("revocarToken es idempotente", async () => {
    const { emitirTokens, revocarToken } = await import("@/lib/oauth/store")
    const tokens = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    await revocarToken(tokens.accessToken)
    await expect(revocarToken(tokens.accessToken)).resolves.toBeUndefined()
  })

  it("revocarTokensDe solo afecta al cliente y usuario indicados", async () => {
    const { emitirTokens, revocarTokensDe, validarAccessToken } = await import("@/lib/oauth/store")
    const deA = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: USUARIO_ID,
      scope: SCOPES.LEER,
      resource: null,
    })
    const deOtroUsuario = await emitirTokens({
      clientId: CLIENT_ID,
      usuarioId: "otro-usuario",
      scope: SCOPES.LEER,
      resource: null,
    })

    await revocarTokensDe(CLIENT_ID, USUARIO_ID)

    expect(await validarAccessToken(deA.accessToken)).toBeNull()
    expect(await validarAccessToken(deOtroUsuario.accessToken)).not.toBeNull()
  })
})
