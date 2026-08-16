import { describe, it, expect } from "vitest"
import type { PagoMcmConRelaciones, PagoMcmTipoCalculo } from "@/lib/types/database"
import {
  formatImporteBanco,
  getConceptoTransferenciaSugerido,
  getIbanPair,
  sanitizarConceptoSEPA,
} from "@/lib/utils/transferencia"

function pago(
  tipo: PagoMcmTipoCalculo,
  concepto: string | null,
  extra: Partial<PagoMcmConRelaciones> = {},
): PagoMcmConRelaciones {
  return { tipo_calculo: tipo, concepto, ...extra } as PagoMcmConRelaciones
}

describe("getConceptoTransferenciaSugerido", () => {
  it("etiqueta el reembolso manual", () => {
    expect(getConceptoTransferenciaSugerido(pago("manual", "Material campamento"))).toBe(
      "MCM · Reembolso · Material campamento",
    )
  })

  it("etiqueta la gasolina por tickets y por kilómetros distinto", () => {
    expect(getConceptoTransferenciaSugerido(pago("gasolina_tickets", "Viaje Sevilla"))).toBe(
      "MCM · Gasolina · Viaje Sevilla",
    )
    expect(getConceptoTransferenciaSugerido(pago("gasolina_km", "Viaje Sevilla"))).toBe(
      "MCM · Gasolina km · Viaje Sevilla",
    )
  })

  it("omite la etiqueta de los tipos que no la tienen", () => {
    expect(getConceptoTransferenciaSugerido(pago("gasolina_avanzado", "Viaje"))).toBe("MCM · Viaje")
  })

  it("omite el concepto vacío en vez de dejar un separador colgando", () => {
    expect(getConceptoTransferenciaSugerido(pago("manual", "   "))).toBe("MCM · Reembolso")
    expect(getConceptoTransferenciaSugerido(pago("manual", null))).toBe("MCM · Reembolso")
  })

  it("no supera los 140 caracteres que admite una transferencia SEPA", () => {
    const salida = getConceptoTransferenciaSugerido(pago("manual", "x".repeat(300)))
    expect(salida).toHaveLength(140)
  })
})

describe("formatImporteBanco", () => {
  it("usa coma decimal y siempre dos decimales", () => {
    expect(formatImporteBanco(24.5)).toBe("24,50")
    expect(formatImporteBanco(1234)).toBe("1234,00")
    expect(formatImporteBanco(0)).toBe("0,00")
  })

  it("no mete separador de miles (los bancos lo rechazan)", () => {
    expect(formatImporteBanco(1234567.89)).toBe("1234567,89")
  })

  it("mantiene el signo negativo", () => {
    expect(formatImporteBanco(-12.3)).toBe("-12,30")
  })
})

describe("getIbanPair", () => {
  it("devuelve el pegable y el legible", () => {
    expect(getIbanPair(" es91 2100 0418 4502 0005 1332 ")).toEqual({
      raw: "ES9121000418450200051332",
      formatted: "ES91 2100 0418 4502 0005 1332",
    })
  })

  it("sin IBAN devuelve dos cadenas vacías", () => {
    expect(getIbanPair(null)).toEqual({ raw: "", formatted: "" })
  })
})

describe("sanitizarConceptoSEPA", () => {
  it("colapsa espacios y recorta", () => {
    expect(sanitizarConceptoSEPA("  Pago   de   gasolina \n ")).toBe("Pago de gasolina")
  })

  it("elimina caracteres de control", () => {
    expect(sanitizarConceptoSEPA("Pago\u0000de\u0007gasolina")).toBe("Pago de gasolina")
  })

  it("respeta los acentos, que los bancos españoles sí admiten", () => {
    expect(sanitizarConceptoSEPA("Donación año")).toBe("Donación año")
  })

  it("recorta a 140 caracteres", () => {
    expect(sanitizarConceptoSEPA("a".repeat(200))).toHaveLength(140)
  })
})
