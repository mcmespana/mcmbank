import { describe, it, expect } from "vitest"
import {
  normalizarNif,
  normalizarNombre,
  parsearFechaFactura,
  parsearImporteFactura,
  parsearMoneda,
  recortar,
} from "./facturas-ia"

/**
 * Estas funciones son la frontera entre lo que dice el modelo y lo que se
 * escribe en la base de datos, así que los casos que importan son los feos:
 * fechas al estilo español, importes con coma, y todo lo que hay que rechazar.
 */

describe("normalizarNombre", () => {
  it("quita acentos, mayúsculas y puntuación", () => {
    expect(normalizarNombre("Papelería Ártica, S.L.")).toBe("papeleria artica s l")
  })

  it("hace comparables dos escrituras del mismo proveedor", () => {
    expect(normalizarNombre("EL CORTE INGLÉS S.A.")).toBe(normalizarNombre("El Corte Ingles, S.A"))
  })

  it("tolera null", () => {
    expect(normalizarNombre(null)).toBe("")
  })
})

describe("normalizarNif", () => {
  it("ignora puntos y guiones", () => {
    expect(normalizarNif("B-12.345.678")).toBe("B12345678")
    expect(normalizarNif("b12345678")).toBe("B12345678")
  })

  it("descarta lo que no puede ser un identificador fiscal", () => {
    expect(normalizarNif("N/A")).toBeNull()
    expect(normalizarNif("12")).toBeNull()
    expect(normalizarNif(null)).toBeNull()
  })
})

describe("parsearFechaFactura", () => {
  const hoy = new Date(Date.UTC(2026, 7, 14))

  it("acepta ISO", () => {
    expect(parsearFechaFactura("2026-03-09", hoy)).toBe("2026-03-09")
  })

  it("acepta el formato español y lo normaliza", () => {
    expect(parsearFechaFactura("09/03/2026", hoy)).toBe("2026-03-09")
    expect(parsearFechaFactura("9-3-2026", hoy)).toBe("2026-03-09")
    expect(parsearFechaFactura("09.03.26", hoy)).toBe("2026-03-09")
  })

  it("no interpreta el día como mes", () => {
    // 12/03 es 12 de marzo, no 3 de diciembre.
    expect(parsearFechaFactura("12/03/2026", hoy)).toBe("2026-03-12")
  })

  it("rechaza fechas que no existen", () => {
    expect(parsearFechaFactura("31/02/2026", hoy)).toBeNull()
    expect(parsearFechaFactura("00/01/2026", hoy)).toBeNull()
  })

  it("rechaza lo que está fuera de rango razonable", () => {
    expect(parsearFechaFactura("1998-05-04", hoy)).toBeNull()
    expect(parsearFechaFactura("2030-01-01", hoy)).toBeNull()
  })

  it("rechaza lo que no es una fecha", () => {
    expect(parsearFechaFactura("F-2026/0042", hoy)).toBeNull()
    expect(parsearFechaFactura(null, hoy)).toBeNull()
  })
})

describe("parsearImporteFactura", () => {
  it("acepta números", () => {
    expect(parsearImporteFactura(1234.56)).toBe(1234.56)
  })

  it("pasa a positivo y redondea a dos decimales", () => {
    expect(parsearImporteFactura(-42.005)).toBe(42.01)
  })

  it("entiende la notación española", () => {
    expect(parsearImporteFactura("1.234,56 €")).toBe(1234.56)
    expect(parsearImporteFactura("1.234,56")).toBe(1234.56)
  })

  it("entiende la notación inglesa", () => {
    expect(parsearImporteFactura("1,234.56")).toBe(1234.56)
    expect(parsearImporteFactura("1234.56")).toBe(1234.56)
  })

  it("descarta ceros, textos y cifras absurdas", () => {
    expect(parsearImporteFactura(0)).toBeNull()
    expect(parsearImporteFactura("pendiente")).toBeNull()
    expect(parsearImporteFactura(99_000_000)).toBeNull()
    expect(parsearImporteFactura(null)).toBeNull()
  })
})

describe("recortar", () => {
  it("colapsa espacios y recorta", () => {
    expect(recortar("  hola   mundo  ", 20)).toBe("hola mundo")
    expect(recortar("abcdefghij", 5)).toBe("abcde")
  })

  it("devuelve null si no queda nada", () => {
    expect(recortar("   ", 10)).toBeNull()
    expect(recortar(undefined, 10)).toBeNull()
  })
})

describe("parsearMoneda", () => {
  it("acepta códigos ISO", () => {
    expect(parsearMoneda("usd")).toBe("USD")
  })

  it("cae a EUR ante cualquier otra cosa", () => {
    expect(parsearMoneda("€")).toBe("EUR")
    expect(parsearMoneda("euros")).toBe("EUR")
    expect(parsearMoneda(null)).toBe("EUR")
  })
})
