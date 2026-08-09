import { describe, it, expect } from "vitest"
import { redirectUriAceptable } from "@/lib/oauth/store"

/**
 * El registro de clientes es abierto (lo exige el flujo de MCP), así que la
 * `redirect_uri` es la única barrera que impide que alguien registre un cliente
 * cuyo "retorno" sea un servidor suyo en claro.
 */
describe("redirectUriAceptable", () => {
  it("acepta https", () => {
    expect(redirectUriAceptable("https://claude.ai/api/mcp/auth_callback")).toBe(true)
  })

  it("acepta http solo en localhost (clientes de escritorio)", () => {
    expect(redirectUriAceptable("http://localhost:33418/oauth/callback")).toBe(true)
    expect(redirectUriAceptable("http://127.0.0.1:8080/cb")).toBe(true)
  })

  it("rechaza http a un dominio externo: el código viajaría en claro", () => {
    expect(redirectUriAceptable("http://sitio-del-atacante.example/cb")).toBe(false)
  })

  it("acepta esquemas propios de aplicaciones nativas", () => {
    expect(redirectUriAceptable("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true)
  })

  it("rechaza javascript: y data:", () => {
    expect(redirectUriAceptable("javascript:alert(1)")).toBe(false)
    expect(redirectUriAceptable("data:text/html,<script>alert(1)</script>")).toBe(false)
  })

  it("rechaza una URI con fragmento", () => {
    // El fragmento no llega al servidor: si viene, algo se está usando mal.
    expect(redirectUriAceptable("https://claude.ai/cb#trozo")).toBe(false)
  })

  it("rechaza lo que ni siquiera es una URL", () => {
    expect(redirectUriAceptable("no soy una url")).toBe(false)
    expect(redirectUriAceptable("")).toBe(false)
  })
})
