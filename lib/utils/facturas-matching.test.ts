import { describe, it, expect } from "vitest"
import { importePendienteFactura } from "@/lib/utils/facturas-matching"

const sinMovimientos = { movimientos: [] as any[] }

describe("importePendienteFactura", () => {
  it("descuenta lo ya vinculado", () => {
    expect(
      importePendienteFactura({
        importe: 3000,
        movimientos: [{ importe: -1500 }] as any,
      }),
    ).toBe(1500)
  })

  it("no baja de cero cuando lo vinculado supera el importe", () => {
    expect(
      importePendienteFactura({ importe: 100, movimientos: [{ importe: -140 }] as any }),
    ).toBe(0)
  })

  it("devuelve null si la factura aún no tiene importe", () => {
    expect(importePendienteFactura({ importe: null, ...sinMovimientos })).toBeNull()
  })

  it("trata un importe negativo como lo que vale", () => {
    // Una factura guardada en negativo daba pendiente 0 —acotado por el max— y
    // se quedaba sin candidatos que ofrecer, sin decir por qué.
    expect(importePendienteFactura({ importe: -250, ...sinMovimientos })).toBe(250)
  })
})
