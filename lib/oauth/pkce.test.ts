import { describe, it, expect } from "vitest"
import { challengeDe, verificarPkce } from "@/lib/oauth/pkce"

describe("verificarPkce", () => {
  it("acepta el verifier que generó el challenge", () => {
    const verifier = "un-verifier-larguito-de-los-que-genera-un-cliente-de-verdad"
    expect(verificarPkce(verifier, challengeDe(verifier))).toBe(true)
  })

  it("rechaza otro verifier", () => {
    expect(verificarPkce("otro-cualquiera", challengeDe("el-bueno"))).toBe(false)
  })

  it("rechaza el vector de ejemplo de la RFC 7636 con el challenge cambiado", () => {
    // Vector oficial (RFC 7636, apéndice B).
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    expect(verificarPkce(verifier, challenge)).toBe(true)
    expect(verificarPkce(verifier, `${challenge.slice(0, -1)}X`)).toBe(false)
  })

  it("rechaza valores vacíos en vez de dejarlos pasar", () => {
    expect(verificarPkce("", "algo")).toBe(false)
    expect(verificarPkce("algo", "")).toBe(false)
  })

  it("no confunde un challenge de otra longitud con una coincidencia", () => {
    expect(verificarPkce("hola", "corto")).toBe(false)
  })
})
