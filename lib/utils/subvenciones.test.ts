import { describe, it, expect } from "vitest"
import {
  SUBVENCION_ESTADOS,
  SUBVENCION_ESTADO_INFO,
  agruparPorAmbito,
  esSubvencionEstado,
  formatearIds,
  fueraDePeriodo,
  importeCobrado,
  importeDesdePorcentaje,
  importeLibre,
  porcentajeDe,
  porcentajeImputado,
  proximaFecha,
  repartirAsignacion,
  totalesEjercicio,
  validarImputacion,
} from "@/lib/utils/subvenciones"
import type { SubvencionConResumen } from "@/lib/types/database"

describe("repartirAsignacion", () => {
  it("entero si está libre, el resto si está en parte en otra, nada si no cabe", () => {
    const r = repartirAsignacion(
      [
        { id: "libre", importe: -100 },
        { id: "mitad", importe: -100 },
        { id: "llena", importe: -50 },
        { id: "aqui", importe: -80 },
      ],
      [
        { movimiento_id: "mitad", subvencion_id: "S2", importe_imputado: 60 },
        { movimiento_id: "llena", subvencion_id: "S2", importe_imputado: 50 },
        { movimiento_id: "aqui", subvencion_id: "S1", importe_imputado: 30 },
      ],
      "S1",
    )
    expect(r.aImputar).toEqual([
      { id: "libre", importe: 100, parcial: false },
      { id: "mitad", importe: 40, parcial: true },
    ])
    expect(r.parciales).toBe(1)
    expect(r.yaEnEsta).toEqual(["aqui"])
    expect([...r.sinHueco.entries()]).toEqual([["S2", ["llena"]]])
  })

  it("no cuenta dos veces un id repetido en la selección", () => {
    const r = repartirAsignacion([{ id: "a", importe: 10 }, { id: "a", importe: 10 }], [], "S1")
    expect(r.aImputar).toHaveLength(1)
  })
})

describe("importeLibre", () => {
  const imp = [
    { movimiento_id: "m", subvencion_id: "S1", importe_imputado: 30 },
    { movimiento_id: "m", subvencion_id: "S2", importe_imputado: 50 },
  ]
  it("descuenta las demás subvenciones, no la propia", () => {
    expect(importeLibre(-100, imp, "S1")).toBe(50)
    expect(importeLibre(-100, imp, "S3")).toBe(20)
  })
  it("nunca negativo", () => {
    expect(importeLibre(-10, imp, "S3")).toBe(0)
  })
})

describe("€ y %", () => {
  it("convierte en los dos sentidos a céntimos", () => {
    expect(porcentajeDe(250, -1000)).toBe(25)
    expect(importeDesdePorcentaje(33.3, 100)).toBe(33.3)
    expect(importeDesdePorcentaje(50, -1234.57)).toBe(617.29)
  })
  it("valida la parte contra lo libre", () => {
    expect(validarImputacion(0, 10)).toMatch(/más de 0/)
    expect(validarImputacion(10.01, 10)).toMatch(/Solo quedan 10,00/)
    expect(validarImputacion(10, 10)).toBeNull()
  })
})

describe("fueraDePeriodo", () => {
  const periodo = { periodo_desde: "2026-01-01", periodo_hasta: "2026-12-31" }
  it("dentro, fuera y sin periodo", () => {
    expect(fueraDePeriodo("2026-01-01", periodo)).toBe(false)
    expect(fueraDePeriodo("2025-12-31", periodo)).toBe(true)
    expect(fueraDePeriodo("2027-01-01", periodo)).toBe(true)
    expect(fueraDePeriodo("1999-01-01", { periodo_desde: null, periodo_hasta: null })).toBe(false)
  })
})

describe("totalesEjercicio", () => {
  it("máximo posible sin descartadas; confirmado y cobrado solo lo comprometido", () => {
    const t = totalesEjercicio([
      { estado: "solicitada", importe_solicitado: 1000, importe_concedido: null, importe_cobrado: null },
      { estado: "concedida", importe_solicitado: 500, importe_concedido: 400, importe_cobrado: 100 },
      { estado: "cobrada", importe_solicitado: 300, importe_concedido: 300, importe_cobrado: null },
      { estado: "rechazada", importe_solicitado: 9999, importe_concedido: 0, importe_cobrado: null },
    ])
    expect(t).toEqual({ solicitado: 1800, confirmado: 700, cobrado: 400, porCobrar: 300 })
  })
  it("cobrada sin importe cobrado cuenta lo concedido", () => {
    expect(importeCobrado({ estado: "cobrada", importe_cobrado: null, importe_concedido: 50 })).toBe(50)
    expect(importeCobrado({ estado: "justificada", importe_cobrado: null, importe_concedido: 50 })).toBe(0)
  })
})

describe("proximaFecha", () => {
  const base = {
    fecha_convocatoria: "2026-02-01",
    fecha_limite_solicitud: "2026-03-01",
    fecha_justificacion_1: "2026-10-01",
    fecha_justificacion_2: "2026-12-01",
  }
  it("antes de solicitar mira el plazo; después, la justificación", () => {
    expect(proximaFecha({ ...base, estado: "por_solicitar" }, "2026-02-15")).toEqual({
      etiqueta: "Límite para solicitar",
      fecha: "2026-03-01",
    })
    expect(proximaFecha({ ...base, estado: "concedida" }, "2026-10-02")?.fecha).toBe("2026-12-01")
  })
  it("nada si está descartada o cobrada", () => {
    expect(proximaFecha({ ...base, estado: "rechazada" }, "2026-01-01")).toBeNull()
    expect(proximaFecha({ ...base, estado: "cobrada" }, "2026-01-01")).toBeNull()
  })
})

describe("agruparPorAmbito", () => {
  const s = (id: string, ambito: any, orden: number, nombre = id) =>
    ({ id, nombre, codigo: null, financiador: { id: "f" + id, nombre: "F" + id, ambito, orden } }) as unknown as SubvencionConResumen
  it("Generalitat arriba, lo raro abajo, y dentro por orden del financiador", () => {
    const grupos = agruparPorAmbito([s("b", "local", 2), s("a", "autonomico", 5), s("c", "local", 1), s("z", "privado", 1)])
    expect(grupos.map((g) => g.ambito)).toEqual(["autonomico", "local", "privado"])
    expect(grupos[1].subvenciones.map((x) => x.id)).toEqual(["c", "b"])
  })
  it("sin financiador va a Otras", () => {
    const sin = { id: "x", nombre: "x", codigo: null, financiador: null } as unknown as SubvencionConResumen
    expect(agruparPorAmbito([sin])[0].ambito).toBe("otro")
  })
})

describe("varios", () => {
  it("formatearIds en los tres formatos", () => {
    expect(formatearIds(["a", "b"], "lineas")).toBe("a\nb")
    expect(formatearIds(["a", "b"], "comas")).toBe("a,b")
    expect(formatearIds(["a", "b"], "json")).toBe('["a","b"]')
  })
  it("porcentajeImputado", () => {
    expect(porcentajeImputado(100, null)).toBeNull()
    expect(porcentajeImputado(1, 3)).toBe(33.3)
  })
  it("todos los estados tienen etiqueta y paso", () => {
    for (const e of SUBVENCION_ESTADOS) {
      expect(SUBVENCION_ESTADO_INFO[e].label).toBeTruthy()
      expect(SUBVENCION_ESTADO_INFO[e].paso).toBeGreaterThan(0)
      expect(esSubvencionEstado(e)).toBe(true)
    }
    expect(esSubvencionEstado("cerrada")).toBe(false)
  })
})
