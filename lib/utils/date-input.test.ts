import { describe, it, expect } from "vitest"
import { formatIsoDateToInput, maskDateInput, parseDateInputToIso } from "./date-input"

describe("formatIsoDateToInput", () => {
  it("convierte ISO yyyy-mm-dd a DD/MM/AAAA", () => {
    expect(formatIsoDateToInput("2026-05-16")).toBe("16/05/2026")
  })

  it("devuelve cadena vacía para null/undefined/vacío", () => {
    expect(formatIsoDateToInput(null)).toBe("")
    expect(formatIsoDateToInput(undefined)).toBe("")
    expect(formatIsoDateToInput("")).toBe("")
  })
})

describe("maskDateInput", () => {
  it("inserta las barras a medida que se escribe", () => {
    expect(maskDateInput("1")).toBe("1")
    expect(maskDateInput("16")).toBe("16")
    expect(maskDateInput("160")).toBe("16/0")
    expect(maskDateInput("1605")).toBe("16/05")
    expect(maskDateInput("16052026")).toBe("16/05/2026")
  })

  it("ignora caracteres no numéricos", () => {
    expect(maskDateInput("16/05/2026")).toBe("16/05/2026")
    expect(maskDateInput("ab16cd05")).toBe("16/05")
  })

  it("trunca a 8 dígitos", () => {
    expect(maskDateInput("160520269999")).toBe("16/05/2026")
  })
})

describe("parseDateInputToIso", () => {
  it("convierte DD/MM/AAAA válido a ISO", () => {
    expect(parseDateInputToIso("16/05/2026")).toBe("2026-05-16")
  })

  it("devuelve null si faltan dígitos", () => {
    expect(parseDateInputToIso("16/05")).toBeNull()
    expect(parseDateInputToIso("")).toBeNull()
  })

  it("devuelve null para fechas imposibles (32 de mes, mes 13)", () => {
    expect(parseDateInputToIso("32/01/2026")).toBeNull()
    expect(parseDateInputToIso("01/13/2026")).toBeNull()
  })

  it("rechaza el 29 de febrero en año no bisiesto", () => {
    expect(parseDateInputToIso("29/02/2025")).toBeNull()
  })

  it("acepta el 29 de febrero en año bisiesto", () => {
    expect(parseDateInputToIso("29/02/2024")).toBe("2024-02-29")
  })
})
