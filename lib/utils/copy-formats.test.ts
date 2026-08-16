import { describe, it, expect } from "vitest"
import type { PagoMcmConRelaciones } from "@/lib/types/database"
import {
  COPY_FORMATS,
  formatCSV,
  formatCompacto,
  formatTabla,
  getPagosTransferibles,
} from "@/lib/utils/copy-formats"

function pago(over: {
  nombre?: string | null
  iban?: string | null
  importe?: number
  estado?: string
  concepto?: string | null
  contacto?: null
}): PagoMcmConRelaciones {
  const { nombre = "Ana Ruiz", iban = "ES9121000418450200051332" } = over
  return {
    estado: over.estado ?? "pendiente",
    importe: over.importe ?? 24.5,
    concepto: over.concepto ?? "Material",
    tipo_calculo: "manual",
    contacto: over.contacto === null ? null : { nombre, iban },
  } as unknown as PagoMcmConRelaciones
}

describe("getPagosTransferibles", () => {
  it("solo deja los pendientes con IBAN", () => {
    const lista = [
      pago({ nombre: "Con IBAN" }),
      pago({ nombre: "Ya pagado", estado: "pagado" }),
      pago({ nombre: "Borrador", estado: "borrador" }),
      pago({ nombre: "Sin IBAN", iban: null }),
      pago({ contacto: null }),
    ]
    expect(getPagosTransferibles(lista).map((p) => p.contacto?.nombre)).toEqual(["Con IBAN"])
  })

  it("con una lista vacía no revienta", () => {
    expect(getPagosTransferibles([])).toEqual([])
  })
})

describe("formatCompacto", () => {
  it("pone nombre, IBAN legible, importe y concepto en una línea", () => {
    expect(formatCompacto([pago({})])).toBe(
      "Ana Ruiz — ES91 2100 0418 4502 0005 1332 — 24,50 € — MCM · Reembolso · Material",
    )
  })

  it("una línea por pago", () => {
    expect(formatCompacto([pago({}), pago({ nombre: "Luis" })]).split("\n")).toHaveLength(2)
  })

  it("sin contacto usa un nombre de respaldo en vez de 'undefined'", () => {
    expect(formatCompacto([pago({ contacto: null })])).toContain("Contacto — ")
  })
})

describe("formatTabla", () => {
  it("alinea las columnas al contenido más largo", () => {
    const salida = formatTabla([pago({ nombre: "Ana" }), pago({ nombre: "Bernardino Pérez" })])
    const [cabecera, separador, fila1, fila2] = salida.split("\n")
    expect(separador).toHaveLength(cabecera.length)
    // Ambas filas empiezan la segunda columna en la misma posición.
    expect(fila1.indexOf("ES91")).toBe(fila2.indexOf("ES91"))
    expect(cabecera.startsWith("Nombre")).toBe(true)
  })

  it("respeta los anchos mínimos de la cabecera aunque los datos sean cortos", () => {
    const salida = formatTabla([pago({ nombre: "Al", iban: "ES91" })])
    expect(salida.split("\n")[0]).toContain("Importe")
  })
})

describe("formatCSV", () => {
  it("usa punto y coma, IBAN sin espacios e importe con coma decimal", () => {
    const [cabecera, fila] = formatCSV([pago({})]).split("\n")
    expect(cabecera).toBe("Nombre;IBAN;Importe;Concepto")
    // El importe sale entrecomillado porque lleva coma: es CSV válido y Excel
    // lo abre igual, pero conviene fijarlo para que no cambie sin querer.
    expect(fila).toBe('Ana Ruiz;ES9121000418450200051332;"24,50";MCM · Reembolso · Material')
  })

  it("entrecomilla y escapa lo que llevaría punto y coma o comillas", () => {
    const fila = formatCSV([pago({ nombre: 'Casa "La Paz"; SL' })]).split("\n")[1]
    expect(fila.startsWith('"Casa ""La Paz""; SL";')).toBe(true)
  })

  it("con lista vacía devuelve solo la cabecera", () => {
    expect(formatCSV([])).toBe("Nombre;IBAN;Importe;Concepto")
  })
})

describe("COPY_FORMATS", () => {
  it("cada formato construye lo mismo que su función", () => {
    const pagos = [pago({})]
    expect(COPY_FORMATS.compacto.build(pagos)).toBe(formatCompacto(pagos))
    expect(COPY_FORMATS.tabla.build(pagos)).toBe(formatTabla(pagos))
    expect(COPY_FORMATS.csv.build(pagos)).toBe(formatCSV(pagos))
  })

  it("todos tienen etiqueta y descripción para el menú", () => {
    for (const formato of Object.values(COPY_FORMATS)) {
      expect(formato.label.length).toBeGreaterThan(0)
      expect(formato.description.length).toBeGreaterThan(0)
    }
  })
})
