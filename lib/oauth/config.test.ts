import { describe, it, expect } from "vitest"
import { SCOPES, normalizarScopes, resourceValido, urlRecurso } from "@/lib/oauth/config"

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
