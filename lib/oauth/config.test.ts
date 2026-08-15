import { describe, it, expect } from "vitest"
import {
  RUTAS,
  SCOPES,
  SCOPES_SOPORTADOS,
  SCOPE_POR_DEFECTO,
  TTL_ACCESS_TOKEN_S,
  TTL_CODIGO_S,
  TTL_REFRESH_TOKEN_S,
  normalizarScopes,
  origenDe,
  resourceValido,
  urlRecurso,
} from "@/lib/oauth/config"

const ORIGEN = "https://banco.movimientoconsolacion.com"

describe("normalizarScopes", () => {
  it("sin nada pedido, concede todo lo que hay", () => {
    expect(normalizarScopes(undefined)).toEqual([SCOPES.LEER, SCOPES.ESCRIBIR])
    expect(normalizarScopes("  ")).toEqual([SCOPES.LEER, SCOPES.ESCRIBIR])
  })

  it("respeta lo que se pide", () => {
    expect(normalizarScopes("mcm:read")).toEqual([SCOPES.LEER])
  })

  it("descarta los que no existen en vez de aceptarlos", () => {
    expect(normalizarScopes("mcm:read admin:todo")).toEqual([SCOPES.LEER])
    expect(normalizarScopes("inventado")).toEqual([])
  })

  it("no duplica ni cambia el orden aunque se repitan", () => {
    expect(normalizarScopes("mcm:write mcm:read mcm:write")).toEqual([SCOPES.LEER, SCOPES.ESCRIBIR])
  })
})

describe("resourceValido", () => {
  it("acepta la URL del propio servidor MCP", () => {
    expect(resourceValido(urlRecurso(ORIGEN), ORIGEN)).toBe(true)
  })

  it("tolera la barra final y las mayúsculas", () => {
    expect(resourceValido(`${ORIGEN}/api/mcp/`, ORIGEN)).toBe(true)
    expect(resourceValido(`${ORIGEN.toUpperCase()}/API/MCP`, ORIGEN)).toBe(true)
  })

  it("no exige el parámetro si no lo mandan", () => {
    expect(resourceValido(null, ORIGEN)).toBe(true)
  })

  it("rechaza un recurso de otro servidor", () => {
    // Lo que evita que un token emitido aquí valga para otro sitio, y al revés.
    expect(resourceValido("https://otro-sitio.example/api/mcp", ORIGEN)).toBe(false)
  })
})

describe("origenDe", () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

  it("usa la URL de la petición cuando no hay proxy delante", () => {
    expect(origenDe(req("https://banco.movimientoconsolacion.com/api/mcp"))).toBe(ORIGEN)
  })

  it("respeta el host que reenvía Vercel", () => {
    // Sin esto, las URLs de descubrimiento saldrían con el host interno y el
    // conector de claude.ai no encontraría el servidor de autorización.
    expect(
      origenDe(
        req("https://interno.vercel.app/api/mcp", {
          "x-forwarded-host": "banco.movimientoconsolacion.com",
        }),
      ),
    ).toBe(ORIGEN)
  })

  it("asume https cuando el proxy no dice el protocolo", () => {
    expect(origenDe(req("http://interno/api/mcp", { "x-forwarded-host": "mcm.test" }))).toBe(
      "https://mcm.test",
    )
  })

  it("respeta el protocolo reenviado (desarrollo en http)", () => {
    expect(
      origenDe(
        req("http://interno/api/mcp", {
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        }),
      ),
    ).toBe("http://localhost:3000")
  })

  it("conserva el puerto de la URL directa", () => {
    expect(origenDe(req("http://localhost:3000/api/mcp"))).toBe("http://localhost:3000")
  })
})

describe("constantes del servidor de autorización", () => {
  it("urlRecurso apunta al servidor MCP", () => {
    expect(urlRecurso(ORIGEN)).toBe(`${ORIGEN}/api/mcp`)
  })

  it("el scope por defecto son los dos soportados", () => {
    expect(SCOPE_POR_DEFECTO.split(" ").sort()).toEqual([...SCOPES_SOPORTADOS].sort())
    expect(normalizarScopes(SCOPE_POR_DEFECTO)).toEqual([...SCOPES_SOPORTADOS])
  })

  it("las rutas de descubrimiento son las que exige el estándar", () => {
    expect(RUTAS.metadatosRecurso).toBe("/.well-known/oauth-protected-resource")
    expect(RUTAS.metadatosServidor).toBe("/.well-known/oauth-authorization-server")
  })

  it("todas las rutas son absolutas respecto al origen", () => {
    for (const ruta of Object.values(RUTAS)) expect(ruta.startsWith("/")).toBe(true)
  })

  it("el código vive menos que el token, y el token menos que el refresco", () => {
    expect(TTL_CODIGO_S).toBeLessThan(TTL_ACCESS_TOKEN_S)
    expect(TTL_ACCESS_TOKEN_S).toBeLessThan(TTL_REFRESH_TOKEN_S)
    // Un código de autorización de más de cinco minutos amplía la ventana de reuso.
    expect(TTL_CODIGO_S).toBeLessThanOrEqual(600)
  })
})
