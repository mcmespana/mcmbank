import { describe, it, expect } from "vitest"
import {
  SUBVENCION_ESTADOS,
  SUBVENCION_ESTADO_INFO,
  esSubvencionEstado,
  formatearIds,
  fueraDePeriodo,
  porcentajeImputado,
  repartirAsignacion,
} from "@/lib/utils/subvenciones"

describe("repartirAsignacion", () => {
  it("separa nuevos, los que ya estaban y los que están en otra", () => {
    const r = repartirAsignacion(
      ["a", "b", "c", "d"],
      [
        { movimiento_id: "b", subvencion_id: "S1" },
        { movimiento_id: "c", subvencion_id: "S2" },
        { movimiento_id: "d", subvencion_id: "S2" },
      ],
      "S1",
    )
    expect(r.nuevos).toEqual(["a"])
    expect(r.yaEnEsta).toEqual(["b"])
    expect([...r.enOtra.entries()]).toEqual([["S2", ["c", "d"]]])
  })

  it("no cuenta dos veces un id repetido en la selección", () => {
    const r = repartirAsignacion(["a", "a"], [], "S1")
    expect(r.nuevos).toEqual(["a"])
  })
})

describe("fueraDePeriodo", () => {
  const periodo = { periodo_desde: "2026-01-01", periodo_hasta: "2026-12-31" }

  it("dentro del periodo, incluidos los extremos", () => {
    expect(fueraDePeriodo("2026-01-01", periodo)).toBe(false)
    expect(fueraDePeriodo("2026-12-31", periodo)).toBe(false)
  })

  it("fuera por cualquiera de los dos lados", () => {
    expect(fueraDePeriodo("2025-12-31", periodo)).toBe(true)
    expect(fueraDePeriodo("2027-01-01", periodo)).toBe(true)
  })

  it("sin periodo nunca avisa, y con un solo extremo mira solo ese", () => {
    expect(fueraDePeriodo("1999-01-01", { periodo_desde: null, periodo_hasta: null })).toBe(false)
    expect(fueraDePeriodo("2030-01-01", { periodo_desde: "2026-01-01", periodo_hasta: null })).toBe(false)
  })

  it("acepta un timestamp y compara solo el día", () => {
    expect(fueraDePeriodo("2026-12-31T23:00:00Z", periodo)).toBe(false)
  })
})

describe("formatearIds", () => {
  const ids = ["a", "b"]
  it("en los tres formatos", () => {
    expect(formatearIds(ids, "lineas")).toBe("a\nb")
    expect(formatearIds(ids, "comas")).toBe("a,b")
    expect(formatearIds(ids, "json")).toBe('["a","b"]')
  })
})

describe("porcentajeImputado", () => {
  it("sin importe concedido no hay porcentaje", () => {
    expect(porcentajeImputado(100, null)).toBeNull()
    expect(porcentajeImputado(100, 0)).toBeNull()
  })
  it("redondea a un decimal y puede pasar de 100", () => {
    expect(porcentajeImputado(1, 3)).toBe(33.3)
    expect(porcentajeImputado(150, 100)).toBe(150)
  })
})

describe("estados", () => {
  it("todos tienen etiqueta, y el guardián los reconoce", () => {
    for (const e of SUBVENCION_ESTADOS) {
      expect(SUBVENCION_ESTADO_INFO[e].label).toBeTruthy()
      expect(esSubvencionEstado(e)).toBe(true)
    }
    expect(esSubvencionEstado("pagada")).toBe(false)
  })
})
