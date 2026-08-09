import { describe, it, expect } from "vitest"
import { aplicarBusquedaTexto, ilikeOrClause, palabrasBusqueda } from "@/lib/api/postgrest"

/** Mock mínimo de un query builder de Supabase que registra los `or()`. */
function mockQuery() {
  const calls: string[] = []
  const q: any = {
    calls,
    or: (filtro: string) => (calls.push(filtro), q),
  }
  return q
}

describe("ilikeOrClause", () => {
  it("entrecomilla el valor para que las comas no partan la cláusula", () => {
    // Sin comillas, PostgREST leería "Mercadona" y " S.A." como dos condiciones.
    expect(ilikeOrClause(["concepto"], "Mercadona, S.A.")).toBe(
      'concepto.ilike."%Mercadona, S.A.%"',
    )
  })

  it("escapa comillas y barras invertidas dentro del valor", () => {
    expect(ilikeOrClause(["concepto"], 'a"b\\c')).toBe('concepto.ilike."%a\\"b\\\\c%"')
  })

  it("repite la condición en cada columna", () => {
    expect(ilikeOrClause(["concepto", "notas"], "luz")).toBe(
      'concepto.ilike."%luz%",notas.ilike."%luz%"',
    )
  })
})

describe("palabrasBusqueda", () => {
  it("parte por espacios y descarta los huecos", () => {
    expect(palabrasBusqueda("  mercadona   valencia ")).toEqual(["mercadona", "valencia"])
  })

  it("corta a un máximo de palabras para no generar una query enorme", () => {
    expect(palabrasBusqueda("a b c d e f g h", 3)).toEqual(["a", "b", "c"])
  })
})

describe("aplicarBusquedaTexto", () => {
  it("no toca el query si no hay texto", () => {
    const q = mockQuery()
    aplicarBusquedaTexto(q, "   ", ["concepto"])
    expect(q.calls).toHaveLength(0)
  })

  it("añade un or() por palabra, de modo que se exigen todas (AND entre or())", () => {
    const q = mockQuery()
    aplicarBusquedaTexto(q, "mercadona valencia", ["concepto", "contraparte"])

    expect(q.calls).toEqual([
      'concepto.ilike."%mercadona%",contraparte.ilike."%mercadona%"',
      'concepto.ilike."%valencia%",contraparte.ilike."%valencia%"',
    ])
  })
})
