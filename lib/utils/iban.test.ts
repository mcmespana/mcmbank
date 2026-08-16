import { describe, it, expect } from "vitest"
import { formatearIban, normalizarIban, validarIban } from "@/lib/utils/iban"

describe("normalizarIban", () => {
  it("quita espacios y pasa a mayúsculas", () => {
    expect(normalizarIban(" es91 2100 0418 4502 0005 1332 ")).toBe("ES9121000418450200051332")
  })

  it("devuelve cadena vacía para valores ausentes", () => {
    expect(normalizarIban(null)).toBe("")
    expect(normalizarIban(undefined)).toBe("")
    expect(normalizarIban("")).toBe("")
  })
})

describe("formatearIban", () => {
  it("agrupa de cuatro en cuatro", () => {
    expect(formatearIban("ES9121000418450200051332")).toBe("ES91 2100 0418 4502 0005 1332")
  })

  it("reagrupa uno que ya venía con espacios mal puestos", () => {
    expect(formatearIban("ES91 21 000418450200051332")).toBe("ES91 2100 0418 4502 0005 1332")
  })

  it("vacío se queda vacío", () => {
    expect(formatearIban(null)).toBe("")
  })
})

describe("validarIban", () => {
  it("acepta IBANs reales de prueba", () => {
    // Ejemplos públicos de documentación bancaria.
    expect(validarIban("ES9121000418450200051332")).toBe(true)
    expect(validarIban("es91 2100 0418 4502 0005 1332")).toBe(true)
    expect(validarIban("DE89370400440532013000")).toBe(true)
    expect(validarIban("GB82WEST12345698765432")).toBe(true)
    expect(validarIban("FR1420041010050500013M02606")).toBe(true)
  })

  it("el campo es opcional: vacío se considera válido", () => {
    expect(validarIban("")).toBe(true)
    expect(validarIban(null)).toBe(true)
    expect(validarIban(undefined)).toBe(true)
  })

  it("rechaza un dígito de control equivocado", () => {
    // Mismo IBAN con los dos dígitos de control cambiados.
    expect(validarIban("ES9221000418450200051332")).toBe(false)
  })

  it("rechaza longitudes imposibles", () => {
    expect(validarIban("ES91")).toBe(false)
    expect(validarIban("ES91" + "1".repeat(40))).toBe(false)
  })

  it("rechaza formatos que no empiezan por dos letras y dos dígitos", () => {
    expect(validarIban("1S9121000418450200051332")).toBe(false)
    expect(validarIban("ESXX21000418450200051332")).toBe(false)
  })

  it("rechaza caracteres que no son alfanuméricos", () => {
    expect(validarIban("ES91-2100-0418-4502-0005-1332")).toBe(false)
  })
})
