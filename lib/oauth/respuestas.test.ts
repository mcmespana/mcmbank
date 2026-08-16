import { describe, it, expect, vi, afterEach } from "vitest"
import { errorOAuth } from "@/lib/oauth/store"
import {
  CORS_OAUTH,
  creadoOAuth,
  cuerpoOAuth,
  errorRespuestaOAuth,
  okOAuth,
  preflightOAuth,
} from "@/lib/oauth/respuestas"

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Los clientes OAuth (claude.ai entre ellos) parsean estas respuestas y actúan
 * según el código: si el formato o las cabeceras se desvían del estándar, el
 * conector deja de configurarse solo y el fallo se ve muy lejos de aquí.
 */
describe("respuestas correctas", () => {
  it("okOAuth devuelve 200 con el JSON y sin caché", async () => {
    const res = okOAuth({ access_token: "abc" })
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("pragma")).toBe("no-cache")
    await expect(res.json()).resolves.toEqual({ access_token: "abc" })
  })

  it("creadoOAuth devuelve 201 (registro dinámico de cliente)", async () => {
    const res = creadoOAuth({ client_id: "c1" })
    expect(res.status).toBe(201)
    expect(res.headers.get("cache-control")).toBe("no-store")
    await expect(res.json()).resolves.toEqual({ client_id: "c1" })
  })

  it("ambas llevan las cabeceras CORS que necesita un cliente de navegador", () => {
    for (const res of [okOAuth({}), creadoOAuth({})]) {
      expect(res.headers.get("access-control-allow-origin")).toBe("*")
      expect(res.headers.get("access-control-allow-headers")).toContain("Authorization")
    }
  })
})

describe("preflightOAuth", () => {
  it("responde 204 sin cuerpo y anuncia los métodos", () => {
    const res = preflightOAuth()
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-methods")).toBe(CORS_OAUTH["Access-Control-Allow-Methods"])
    expect(res.headers.get("access-control-max-age")).toBe("86400")
  })
})

describe("errorRespuestaOAuth", () => {
  it("un ErrorOAuth sale en el formato del estándar, no en el de la API", async () => {
    const res = errorRespuestaOAuth(errorOAuth("invalid_grant", "El código ya se usó."))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "El código ya se usó.",
    })
  })

  it("respeta el estado que pide el error (401 en cliente inválido)", async () => {
    const res = errorRespuestaOAuth(errorOAuth("invalid_client", "Cliente desconocido.", 401))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_client" })
  })

  it("cualquier otro error es server_error, sin publicar la traza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = errorRespuestaOAuth(new Error("boom\n    at /var/task/lib/oauth/store.ts:12"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: "server_error", error_description: "boom" })
  })

  it("los errores tampoco se cachean", () => {
    const res = errorRespuestaOAuth(errorOAuth("invalid_request", "Falta code_verifier."))
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("access-control-allow-origin")).toBe("*")
  })
})

describe("cuerpoOAuth", () => {
  const post = (body: string, contentType: string) =>
    new Request("https://mcm.test/api/oauth/token", {
      method: "POST",
      body,
      headers: { "content-type": contentType },
    })

  it("lee el formulario que manda el estándar", async () => {
    const cuerpo = await cuerpoOAuth(
      post("grant_type=authorization_code&code=abc", "application/x-www-form-urlencoded"),
    )
    expect(cuerpo).toEqual({ grant_type: "authorization_code", code: "abc" })
  })

  it("acepta también JSON, que es lo que envían varios clientes", async () => {
    const cuerpo = await cuerpoOAuth(
      post(JSON.stringify({ grant_type: "refresh_token", refresh_token: "r1" }), "application/json"),
    )
    expect(cuerpo).toEqual({ grant_type: "refresh_token", refresh_token: "r1" })
  })

  it("convierte a texto los valores no textuales del JSON", async () => {
    const cuerpo = await cuerpoOAuth(post(JSON.stringify({ expires_in: 3600 }), "application/json"))
    expect(cuerpo.expires_in).toBe("3600")
  })

  it("descarta las claves nulas en vez de mandar 'null' como valor", async () => {
    const cuerpo = await cuerpoOAuth(
      post(JSON.stringify({ code: "abc", client_secret: null }), "application/json"),
    )
    expect(cuerpo).toEqual({ code: "abc" })
  })

  it("un JSON roto no tumba el endpoint: cuerpo vacío", async () => {
    await expect(cuerpoOAuth(post("{roto", "application/json"))).resolves.toEqual({})
  })

  it("sin content-type se interpreta como formulario", async () => {
    const req = new Request("https://mcm.test/api/oauth/token", { method: "POST", body: "code=x" })
    req.headers.delete("content-type")
    await expect(cuerpoOAuth(req)).resolves.toEqual({ code: "x" })
  })

  it("decodifica el porcentaje y el '+' del formulario", async () => {
    const cuerpo = await cuerpoOAuth(
      post("redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&scope=mcm%3Aread+mcm%3Awrite", "application/x-www-form-urlencoded"),
    )
    expect(cuerpo.redirect_uri).toBe("https://claude.ai/cb")
    expect(cuerpo.scope).toBe("mcm:read mcm:write")
  })
})
