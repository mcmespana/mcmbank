import { describe, it, expect } from "vitest"
import { applyAbsoluteAmountFilter } from "@/lib/db/amount-filter"

/**
 * Mock mínimo de un query builder de Supabase que registra las llamadas
 * encadenadas (gte/lte/or) para poder afirmar sobre ellas.
 */
function mockQuery() {
  const calls: Array<{ method: string; args: any[] }> = []
  const q: any = {
    calls,
    gte: (...args: any[]) => (calls.push({ method: "gte", args }), q),
    lte: (...args: any[]) => (calls.push({ method: "lte", args }), q),
    or: (...args: any[]) => (calls.push({ method: "or", args }), q),
  }
  return q
}

describe("applyAbsoluteAmountFilter", () => {
  it("sin rango no añade ninguna restricción", () => {
    const q = mockQuery()
    applyAbsoluteAmountFilter(q, undefined, undefined)
    expect(q.calls).toHaveLength(0)
  })

  it("con rango [100, 300] acota |importe| en ese intervalo (incluye negativos)", () => {
    const q = mockQuery()
    applyAbsoluteAmountFilter(q, 100, 300)
    // -300 <= importe <= 300 AND (importe >= 100 OR importe <= -100)
    expect(q.calls).toEqual([
      { method: "gte", args: ["importe", -300] },
      { method: "lte", args: ["importe", 300] },
      { method: "or", args: ["importe.gte.100,importe.lte.-100"] },
    ])
  })

  it("normaliza el orden y el signo de los límites del rango", () => {
    const q = mockQuery()
    // from mayor que to y con signos mezclados: debe usar |valores| min/max
    applyAbsoluteAmountFilter(q, -300, 100)
    expect(q.calls).toEqual([
      { method: "gte", args: ["importe", -300] },
      { method: "lte", args: ["importe", 300] },
      { method: "or", args: ["importe.gte.100,importe.lte.-100"] },
    ])
  })

  it("solo con mínimo: |importe| >= valor", () => {
    const q = mockQuery()
    applyAbsoluteAmountFilter(q, 50, undefined)
    expect(q.calls).toEqual([{ method: "or", args: ["importe.gte.50,importe.lte.-50"] }])
  })

  it("solo con máximo: |importe| <= valor", () => {
    const q = mockQuery()
    applyAbsoluteAmountFilter(q, undefined, 200)
    expect(q.calls).toEqual([
      { method: "gte", args: ["importe", -200] },
      { method: "lte", args: ["importe", 200] },
    ])
  })
})
