import { describe, it, expect } from "vitest"
import { formatCurrency, formatDate, getAmountColorClass, toLocalDateString } from "./format"

describe("toLocalDateString", () => {
  it("formatea una fecha normal como yyyy-mm-dd con la fecha local", () => {
    // Mediodía local: el día nunca cambia por conversión a UTC en ningún huso.
    expect(toLocalDateString(new Date(2026, 5, 13, 12, 0, 0))).toBe("2026-06-13")
  })

  it("rellena con cero el mes y el día de un solo dígito", () => {
    expect(toLocalDateString(new Date(2026, 0, 1, 12, 0, 0))).toBe("2026-01-01")
    expect(toLocalDateString(new Date(2025, 8, 1, 12, 0, 0))).toBe("2025-09-01")
  })

  it("mantiene el día en la medianoche local (no se desplaza como con toISOString)", () => {
    // Este es el bug de la Fase 0.1: medianoche local del 1 de septiembre.
    // toISOString() lo movería al 31/08 en husos > UTC; toLocalDateString no.
    const medianoche = new Date(2025, 8, 1, 0, 0, 0)
    expect(toLocalDateString(medianoche)).toBe("2025-09-01")
  })

  it("maneja el último día del año", () => {
    expect(toLocalDateString(new Date(2025, 11, 31, 12, 0, 0))).toBe("2025-12-31")
  })
})

describe("formatCurrency", () => {
  it("usa coma decimal y punto de millares (estilo es-ES)", () => {
    expect(formatCurrency(1234.5)).toBe("1.234,50 €")
  })

  it("muestra el signo negativo delante", () => {
    expect(formatCurrency(-150)).toBe("-150,00 €")
  })

  it("formatea cero con dos decimales", () => {
    expect(formatCurrency(0)).toBe("0,00 €")
  })

  it("agrupa miles incluso en valores de 4 dígitos", () => {
    expect(formatCurrency(1000)).toBe("1.000,00 €")
  })

  it("acepta una divisa personalizada", () => {
    expect(formatCurrency(10, "$")).toBe("10,00 $")
  })
})

describe("formatDate", () => {
  it("pinta una fecha ISO en formato español", () => {
    expect(formatDate("2026-06-13T12:00:00")).toBe("13/06/2026")
  })

  it("rellena con ceros el día y el mes", () => {
    expect(formatDate("2026-01-05T12:00:00")).toBe("05/01/2026")
  })
})

describe("getAmountColorClass", () => {
  it("los ingresos van en verde y los gastos en rojo", () => {
    expect(getAmountColorClass(10)).toContain("text-green-600")
    expect(getAmountColorClass(-10)).toContain("text-red-600")
  })

  it("el cero cuenta como gasto (no hay un tercer color)", () => {
    expect(getAmountColorClass(0)).toContain("text-red-600")
  })

  it("siempre incluye el peso de fuente", () => {
    expect(getAmountColorClass(1)).toContain("font-medium")
  })
})
