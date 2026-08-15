import { describe, it, expect } from "vitest"
import {
  esMatchDirecto,
  importePendienteFactura,
  scoreCandidatoMovimiento,
} from "@/lib/utils/facturas-matching"

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

const MOV = { importe: -21, fecha: "2026-08-13", contacto_id: null }

describe("scoreCandidatoMovimiento", () => {
  it("descarta el movimiento de otra cadena aunque el importe y la fecha cuadren", () => {
    const score = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Mercadona S.A." },
      { ...MOV, concepto: "COMPRA TARJ. AMZN MKTP ES*2K4LP" },
    )

    expect(score.importeExacto).toBe(true)
    expect(score.otroProveedorEnConcepto).toBe(true)
    expect(esMatchDirecto([score])).toBe(false)
  })

  it("confirma el movimiento cuando el concepto nombra a la misma cadena", () => {
    const score = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Mercadona S.A." },
      { ...MOV, concepto: "COMPRA TARJ. MERCADONA 4021 SEVILLA" },
    )

    expect(score.nombreEnConcepto).toBe(true)
    expect(score.otroProveedorEnConcepto).toBe(false)
    expect(esMatchDirecto([score])).toBe(true)
  })

  it("no concluye nada del silencio: una cadena sin rastro en el concepto sigue siendo candidata", () => {
    const score = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Mercadona" },
      { ...MOV, concepto: "PAGO CON TARJETA 4021" },
    )

    expect(score.nombreEnConcepto).toBe(false)
    expect(score.otroProveedorEnConcepto).toBe(false)
    expect(esMatchDirecto([score])).toBe(true)
  })

  it("con un proveedor cualquiera solo premia el acierto, nunca descarta", () => {
    const acierta = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Papelería Peñalba" },
      { ...MOV, concepto: "RECIBO PAPELERIA PENALBA" },
    )
    const calla = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Papelería Peñalba" },
      { ...MOV, concepto: "COMPRA TARJ. AMZN MKTP ES*2K4LP" },
    )

    expect(acierta.nombreEnConcepto).toBe(true)
    expect(calla.otroProveedorEnConcepto).toBe(false)
    expect(acierta.score).toBeGreaterThan(calla.score)
  })

  it("no confunde una cadena con una palabra que la contiene", () => {
    const score = scoreCandidatoMovimiento(
      { importe: 21, fecha_emision: "2026-08-13", contacto_nombre: "Mercadona" },
      { ...MOV, concepto: "ALQUILER LOCAL AVENIDA DIAGONAL" },
    )

    expect(score.otroProveedorEnConcepto).toBe(false)
  })
})
