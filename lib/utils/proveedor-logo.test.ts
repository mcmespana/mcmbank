import { describe, expect, it } from "vitest"
import { dominiosCandidatos, limpiarDominio, normalizarClaveProveedor } from "./proveedor-logo"

describe("normalizarClaveProveedor", () => {
  it("colapsa las variantes del mismo proveedor en una sola clave", () => {
    const esperada = "mercadona"
    for (const variante of ["Mercadona", "MERCADONA", "MERCADONA, S.A.", "mercadona sa", "  Mercadona  "]) {
      expect(normalizarClaveProveedor(variante)).toBe(esperada)
    }
  })

  it("quita los acentos", () => {
    expect(normalizarClaveProveedor("Leroy Merlín")).toBe("leroy merlin")
    expect(normalizarClaveProveedor("Alimentación Pérez")).toBe("alimentacion perez")
  })

  it("pliega la ñ a n, para que quien la escriba sin tilde caiga en la misma ficha", () => {
    expect(normalizarClaveProveedor("Peñalba")).toBe("penalba")
    expect(normalizarClaveProveedor("Penalba")).toBe("penalba")
  })

  it("quita varias formas jurídicas encadenadas, pero nunca el nombre entero", () => {
    expect(normalizarClaveProveedor("Rutas Rodriguez S.L.U.")).toBe("rutas rodriguez")
    expect(normalizarClaveProveedor("Transvia SL")).toBe("transvia")
    // Si lo único que hay es la forma jurídica, se queda: es el nombre.
    expect(normalizarClaveProveedor("SA")).toBe("sa")
    expect(normalizarClaveProveedor("Coop")).toBe("coop")
  })

  it("no confunde una forma jurídica con el principio del nombre", () => {
    expect(normalizarClaveProveedor("SL Deportes")).toBe("sl deportes")
  })

  it("devuelve cadena vacía para lo que no es un nombre", () => {
    expect(normalizarClaveProveedor(null)).toBe("")
    expect(normalizarClaveProveedor("   ")).toBe("")
    expect(normalizarClaveProveedor("...")).toBe("")
  })
})

describe("limpiarDominio", () => {
  it("quita esquema, www, ruta y mayúsculas", () => {
    expect(limpiarDominio("https://WWW.Mercadona.es/tienda?x=1")).toBe("mercadona.es")
    expect(limpiarDominio("mercadona.es")).toBe("mercadona.es")
    expect(limpiarDominio("http://tienda.mercadona.es")).toBe("tienda.mercadona.es")
  })

  it("rechaza lo que no puede ser un dominio", () => {
    expect(limpiarDominio("mercadona")).toBeNull()
    expect(limpiarDominio("")).toBeNull()
    expect(limpiarDominio(null)).toBeNull()
    expect(limpiarDominio("no es un dominio")).toBeNull()
  })
})

describe("dominiosCandidatos", () => {
  it("pone primero el dominio escrito a mano", () => {
    const candidatos = dominiosCandidatos("Mercadona", "https://super.example.com/")
    expect(candidatos[0]).toBe("super.example.com")
    expect(candidatos).toContain("mercadona.es")
  })

  it("usa el catálogo cuando no hay dominio escrito", () => {
    expect(dominiosCandidatos("MERCADONA, S.A.")[0]).toBe("mercadona.es")
    expect(dominiosCandidatos("Leroy Merlín")[0]).toBe("leroymerlin.es")
  })

  it("especula con el nombre solo si se le pide", () => {
    const candidatos = dominiosCandidatos("Rutas Rodriguez S.L.", null, { especular: true })
    expect(candidatos).toContain("rutasrodriguez.es")
    expect(candidatos).toContain("rutasrodriguez.com")
    expect(candidatos).toContain("rutas.es")
  })

  it("ignora artículos al especular", () => {
    expect(dominiosCandidatos("Casa de la Juventud", null, { especular: true })).toContain("casajuventud.es")
  })

  it("no especula por defecto: un dominio inventado puede ser de otra empresa", () => {
    expect(dominiosCandidatos("Rutas Rodriguez S.L.")).toEqual([])
    expect(dominiosCandidatos("Casa Don Bosco Godelleta")).toEqual([])
  })

  it("no devuelve duplicados", () => {
    const candidatos = dominiosCandidatos("Mercadona", "mercadona.es")
    expect(candidatos).toEqual(Array.from(new Set(candidatos)))
  })

  it("no revienta sin nombre", () => {
    expect(dominiosCandidatos(null)).toEqual([])
    expect(dominiosCandidatos("")).toEqual([])
  })
})
