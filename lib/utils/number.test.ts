import { describe, it, expect } from "vitest"
import { parseEuropeanNumber } from "@/lib/utils/number"

/**
 * Este parser es la puerta por la que entran los importes: lo que escribe una
 * tesorera a mano y lo que trae una columna de Excel importada. Equivocarse en
 * el separador decimal convierte 1.234,56 € en 1,23 €, así que aquí se fija
 * el comportamiento caso por caso.
 */
describe("parseEuropeanNumber", () => {
  it("deja pasar los números tal cual", () => {
    expect(parseEuropeanNumber(270.41)).toBe(270.41)
    expect(parseEuropeanNumber(0)).toBe(0)
    expect(parseEuropeanNumber(-3)).toBe(-3)
  })

  it("devuelve NaN para lo que no es un número", () => {
    for (const v of [null, undefined, "", "   ", "-", "+", "abc"]) {
      expect(Number.isNaN(parseEuropeanNumber(v as any))).toBe(true)
    }
  })

  it("lee el decimal español (coma)", () => {
    expect(parseEuropeanNumber("270,41")).toBe(270.41)
    expect(parseEuropeanNumber("0,5")).toBe(0.5)
    expect(parseEuropeanNumber("-12,5")).toBe(-12.5)
  })

  it("lee el decimal inglés (punto)", () => {
    expect(parseEuropeanNumber("1234.56")).toBe(1234.56)
    expect(parseEuropeanNumber("0.05")).toBe(0.05)
  })

  it("distingue miles de decimales cuando solo hay un punto", () => {
    // Tres cifras detrás del punto: es separador de miles, no decimal.
    expect(parseEuropeanNumber("1.234")).toBe(1234)
    // Dos o menos: es decimal.
    expect(parseEuropeanNumber("1.23")).toBe(1.23)
    expect(parseEuropeanNumber("1.2")).toBe(1.2)
  })

  it("entiende el formato europeo completo (miles con punto, decimal con coma)", () => {
    expect(parseEuropeanNumber("1.234,56")).toBe(1234.56)
    expect(parseEuropeanNumber("1.234.567,89")).toBe(1234567.89)
  })

  it("entiende el formato americano completo (miles con coma, decimal con punto)", () => {
    expect(parseEuropeanNumber("1,234.56")).toBe(1234.56)
    expect(parseEuropeanNumber("1,234,567.89")).toBe(1234567.89)
  })

  it("resuelve el caso ambiguo (varias comas y varios puntos) como europeo", () => {
    expect(parseEuropeanNumber("1.234.567,89")).toBe(1234567.89)
  })

  it("limpia el ruido que acompaña a un importe copiado", () => {
    expect(parseEuropeanNumber("-12,5 €")).toBe(-12.5)
    expect(parseEuropeanNumber(" 1.234,56 € ")).toBe(1234.56)
    expect(parseEuropeanNumber("(45,20)")).toBe(45.2)
    expect(parseEuropeanNumber("- 45,20")).toBe(-45.2)
  })

  it("acepta enteros sin separador", () => {
    expect(parseEuropeanNumber("1234")).toBe(1234)
    expect(parseEuropeanNumber("-7")).toBe(-7)
    expect(parseEuropeanNumber("+7")).toBe(7)
  })
})
