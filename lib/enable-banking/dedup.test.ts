import { describe, it, expect } from "vitest"
import { resolveExternalId, mapTransactionToMovimiento } from "@/lib/enable-banking/dedup"
import type { EBTransaction } from "@/lib/enable-banking/types"

function baseTx(overrides: Partial<EBTransaction> = {}): EBTransaction {
  return {
    status: "BOOK",
    credit_debit_indicator: "DBIT",
    transaction_amount: { currency: "EUR", amount: "100.50" },
    booking_date: "2026-01-15",
    ...overrides,
  }
}

describe("resolveExternalId", () => {
  it("usa transaction_id con prefijo tid: cuando está presente", () => {
    const result = resolveExternalId(baseTx({ transaction_id: "abc123" }))
    expect(result).toEqual({ external_id: "tid:abc123", source: "transaction_id" })
  })

  it("un transaction_id en blanco cae al siguiente nivel (entry_reference)", () => {
    const result = resolveExternalId(baseTx({ transaction_id: "   ", entry_reference: "ref-1" }))
    expect(result).toEqual({ external_id: "eref:ref-1", source: "entry_reference" })
  })

  it("sin transaction_id, usa entry_reference con prefijo eref:", () => {
    const result = resolveExternalId(baseTx({ entry_reference: "ref-42" }))
    expect(result).toEqual({ external_id: "eref:ref-42", source: "entry_reference" })
  })

  it("sin transaction_id ni entry_reference, cae al hash compuesto", () => {
    const result = resolveExternalId(baseTx())
    expect(result.source).toBe("composite_hash")
    expect(result.external_id).toMatch(/^ch:[0-9a-f]{32}$/)
  })

  it("el hash es determinista para la misma transacción", () => {
    const tx = baseTx({ remittance_information: ["Cuota mensual"] })
    const a = resolveExternalId(tx)
    const b = resolveExternalId(baseTx({ remittance_information: ["Cuota mensual"] }))
    expect(a.external_id).toBe(b.external_id)
  })

  it("dos pagos del mismo día e importe con IBAN de contraparte distinto producen hashes distintos", () => {
    const a = resolveExternalId(
      baseTx({ creditor_account: { iban: "ES1111111111111111111111" } }),
    )
    const b = resolveExternalId(
      baseTx({ creditor_account: { iban: "ES2222222222222222222222" } }),
    )
    expect(a.external_id).not.toBe(b.external_id)
  })

  it("dos pagos del mismo día e importe con remittance_information distinto producen hashes distintos (caso 5 aportaciones mensuales)", () => {
    const a = resolveExternalId(baseTx({ remittance_information: ["Aportación socio A"] }))
    const b = resolveExternalId(baseTx({ remittance_information: ["Aportación socio B"] }))
    expect(a.external_id).not.toBe(b.external_id)
  })

  it("prioriza el IBAN sobre el nombre: cambiar el IBAN cambia el hash aunque el nombre no cambie", () => {
    const a = resolveExternalId(
      baseTx({ creditor_account: { iban: "ES1111111111111111111111" }, creditor: { name: "Mismo nombre" } }),
    )
    const b = resolveExternalId(
      baseTx({ creditor_account: { iban: "ES2222222222222222222222" }, creditor: { name: "Mismo nombre" } }),
    )
    expect(a.external_id).not.toBe(b.external_id)
  })
})

const ctx = { cuenta_id: "cuenta-1", delegacion_id: "deleg-1", creado_por: "user-1" }

describe("mapTransactionToMovimiento", () => {
  it("DBIT + importe positivo produce importe negativo", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ credit_debit_indicator: "DBIT", transaction_amount: { currency: "EUR", amount: "100.50" } }),
      ctx,
    )
    expect(result.importe).toBe(-100.5)
  })

  it("CRDT + importe positivo produce importe positivo", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ credit_debit_indicator: "CRDT", transaction_amount: { currency: "EUR", amount: "100.50" } }),
      ctx,
    )
    expect(result.importe).toBe(100.5)
  })

  it("CRDT + importe negativo se normaliza a positivo (abs)", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ credit_debit_indicator: "CRDT", transaction_amount: { currency: "EUR", amount: "-100.50" } }),
      ctx,
    )
    expect(result.importe).toBe(100.5)
  })

  it("characterization: indicador ausente/no reconocido se trata como crédito (positivo)", () => {
    // characterization: see plans/README.md deferred list
    const result = mapTransactionToMovimiento(
      baseTx({ credit_debit_indicator: undefined as unknown as EBTransaction["credit_debit_indicator"] }),
      ctx,
    )
    expect(result.importe).toBe(100.5)
  })

  it("characterization: importe no parseable produce 0 silenciosamente", () => {
    // characterization: see plans/README.md deferred list
    const result = mapTransactionToMovimiento(
      baseTx({ transaction_amount: { currency: "EUR", amount: "abc" } }),
      ctx,
    )
    expect(result.importe).toBe(0)
  })

  it("fecha prioriza booking_date sobre value_date y transaction_date", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ booking_date: "2026-01-15", value_date: "2026-01-16", transaction_date: "2026-01-17" }),
      ctx,
    )
    expect(result.fecha).toBe("2026-01-15")
  })

  it("sin booking_date, usa value_date", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ booking_date: undefined, value_date: "2026-01-16", transaction_date: "2026-01-17" }),
      ctx,
    )
    expect(result.fecha).toBe("2026-01-16")
  })

  it("sin booking_date ni value_date, usa transaction_date", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ booking_date: undefined, value_date: undefined, transaction_date: "2026-01-17" }),
      ctx,
    )
    expect(result.fecha).toBe("2026-01-17")
  })

  it("concepto usa la primera línea de remittance_information si existe", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ remittance_information: ["Pago factura", "línea 2"] }),
      ctx,
    )
    expect(result.concepto).toBe("Pago factura")
  })

  it("concepto cae al nombre del acreedor si no hay remittance_information", () => {
    const result = mapTransactionToMovimiento(baseTx({ creditor: { name: "Proveedor SL" } }), ctx)
    expect(result.concepto).toBe("Proveedor SL")
  })

  it("concepto cae a reference_number si no hay remittance ni nombres", () => {
    const result = mapTransactionToMovimiento(baseTx({ reference_number: "REF-99" }), ctx)
    expect(result.concepto).toBe("REF-99")
  })

  it("concepto cae a 'Movimiento bancario' si no hay ningún dato", () => {
    const result = mapTransactionToMovimiento(baseTx(), ctx)
    expect(result.concepto).toBe("Movimiento bancario")
  })

  it("concepto se trunca a 500 caracteres", () => {
    const largo = "x".repeat(600)
    const result = mapTransactionToMovimiento(baseTx({ remittance_information: [largo] }), ctx)
    expect(result.concepto).toHaveLength(500)
  })

  it("descripcion junta las líneas 2+ de remittance_information con salto de línea", () => {
    const result = mapTransactionToMovimiento(
      baseTx({ remittance_information: ["Concepto", "línea 2", "línea 3"] }),
      ctx,
    )
    expect(result.descripcion).toBe("línea 2\nlínea 3")
  })

  it("descripcion es null si solo hay una línea (o ninguna) de remittance_information", () => {
    const result = mapTransactionToMovimiento(baseTx({ remittance_information: ["única línea"] }), ctx)
    expect(result.descripcion).toBeNull()
  })
})
