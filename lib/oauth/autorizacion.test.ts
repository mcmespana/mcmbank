import { describe, it, expect, vi, beforeEach } from "vitest"

// `validarAutorizacion` consulta el cliente registrado en la base de datos. Se
// sustituye el almacén por uno de mentira para poder probar la validación sin
// Supabase: lo que se comprueba aquí son las reglas, no el SQL.
vi.mock("@/lib/oauth/store", async () => {
  const real = await vi.importActual<typeof import("@/lib/oauth/store")>("@/lib/oauth/store")
  return {
    ...real,
    obtenerCliente: vi.fn(),
  }
})

import { validarAutorizacion, urlDeError, urlDeExito } from "@/lib/oauth/autorizacion"
import { obtenerCliente } from "@/lib/oauth/store"
import { challengeDe } from "@/lib/oauth/pkce"

const ORIGEN = "https://banco.movimientoconsolacion.com"
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"

const CLIENTE = {
  client_id: "mcm-123",
  nombre: "Claude",
  redirect_uris: [REDIRECT],
  creado_en: new Date().toISOString(),
}

function peticion(extra: Record<string, string | undefined> = {}) {
  return {
    client_id: CLIENTE.client_id,
    redirect_uri: REDIRECT,
    response_type: "code",
    code_challenge: challengeDe("mi-verifier"),
    code_challenge_method: "S256",
    scope: "mcm:read mcm:write",
    state: "xyz",
    ...extra,
  }
}

beforeEach(() => {
  vi.mocked(obtenerCliente).mockResolvedValue(CLIENTE)
})

describe("validarAutorizacion", () => {
  it("acepta una petición correcta", async () => {
    const r = await validarAutorizacion(peticion(), ORIGEN)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cliente.client_id).toBe("mcm-123")
      expect(r.scopes).toEqual(["mcm:read", "mcm:write"])
      expect(r.state).toBe("xyz")
    }
  })

  // Los dos casos "fatales": no se puede redirigir porque no sabemos a dónde
  // sería seguro. Redirigir aquí es exactamente el agujero clásico de OAuth.
  it("es fatal si el cliente no existe", async () => {
    vi.mocked(obtenerCliente).mockResolvedValue(null)
    const r = await validarAutorizacion(peticion(), ORIGEN)
    expect(r).toMatchObject({ ok: false, tipo: "fatal" })
  })

  it("es fatal si la redirect_uri no está registrada", async () => {
    const r = await validarAutorizacion(
      peticion({ redirect_uri: "https://sitio-del-atacante.example/robar" }),
      ORIGEN,
    )
    expect(r).toMatchObject({ ok: false, tipo: "fatal" })
  })

  it("exige coincidencia exacta de redirect_uri (no basta el mismo dominio)", async () => {
    const r = await validarAutorizacion(
      peticion({ redirect_uri: `${REDIRECT}/otra-cosa` }),
      ORIGEN,
    )
    expect(r).toMatchObject({ ok: false, tipo: "fatal" })
  })

  // El resto son errores que sí se devuelven por la redirección, ya validada.
  it("rechaza response_type distinto de code", async () => {
    const r = await validarAutorizacion(peticion({ response_type: "token" }), ORIGEN)
    expect(r).toMatchObject({ ok: false, tipo: "redirigible", error: "invalid_request" })
  })

  it("exige PKCE", async () => {
    const r = await validarAutorizacion(peticion({ code_challenge: undefined }), ORIGEN)
    expect(r).toMatchObject({ ok: false, tipo: "redirigible" })
    if (!r.ok && r.tipo === "redirigible") expect(r.descripcion).toMatch(/PKCE/)
  })

  it("rechaza el método plain de PKCE", async () => {
    const r = await validarAutorizacion(peticion({ code_challenge_method: "plain" }), ORIGEN)
    expect(r).toMatchObject({ ok: false, tipo: "redirigible" })
    if (!r.ok && r.tipo === "redirigible") expect(r.descripcion).toMatch(/S256/)
  })

  it("rechaza un resource que apunta a otro servidor", async () => {
    const r = await validarAutorizacion(
      peticion({ resource: "https://otro.example/api/mcp" }),
      ORIGEN,
    )
    expect(r).toMatchObject({ ok: false, tipo: "redirigible" })
  })

  it("rechaza cuando ningún scope pedido existe", async () => {
    const r = await validarAutorizacion(peticion({ scope: "borrarlo:todo" }), ORIGEN)
    expect(r).toMatchObject({ ok: false, tipo: "redirigible", error: "invalid_scope" })
  })
})

describe("urls de vuelta", () => {
  it("el error viaja con su descripción y el state", () => {
    const url = new URL(
      urlDeError({
        ok: false,
        tipo: "redirigible",
        redirectUri: REDIRECT,
        error: "access_denied",
        descripcion: "La conexión se ha cancelado.",
        state: "xyz",
      }),
    )
    expect(url.searchParams.get("error")).toBe("access_denied")
    expect(url.searchParams.get("error_description")).toBe("La conexión se ha cancelado.")
    expect(url.searchParams.get("state")).toBe("xyz")
  })

  it("el éxito lleva el código y conserva el state", () => {
    const url = new URL(urlDeExito(REDIRECT, "el-codigo", "xyz"))
    expect(url.searchParams.get("code")).toBe("el-codigo")
    expect(url.searchParams.get("state")).toBe("xyz")
  })

  it("sin state, no se inventa uno", () => {
    const url = new URL(urlDeExito(REDIRECT, "el-codigo", null))
    expect(url.searchParams.has("state")).toBe(false)
  })
})
