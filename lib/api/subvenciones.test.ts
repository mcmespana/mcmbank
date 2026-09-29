import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Subvenciones desde la API: la ficha con su resumen, y los movimientos
 * imputados de varias delegaciones. Los catálogos se cachean a nivel de
 * módulo, así que cada test recarga los módulos (ver pagos.test.ts).
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }

const SUB = {
  id: "sub-1",
  nombre: "IVAJ 2026",
  financiador: "IVAJ",
  convocatoria: null,
  expediente: "EXP-1",
  ejercicio: 2026,
  estado: "concedida",
  fecha_solicitud: null,
  importe_solicitado: null,
  fecha_concesion: "2026-05-01",
  importe_concedido: "1000.00",
  periodo_desde: null,
  periodo_hasta: null,
  fecha_limite_justificacion: null,
  notas: null,
  creado_en: "2026-01-01T00:00:00Z",
  actualizado_en: "2026-01-01T00:00:00Z",
}

function movimiento(id: string, delegacion_id: string, fecha: string, importe: number) {
  return {
    id,
    delegacion_id,
    fecha,
    importe,
    concepto: `Gasto ${id}`,
    cuenta_id: null,
    categoria_id: null,
    contacto_id: null,
    ignorado: false,
    creado_en: "2026-01-01T00:00:00Z",
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    cuenta: [],
    categoria: [],
    contacto: [],
    movimiento_archivo: [],
    subvencion: [SUB, { ...SUB, id: "sub-2", nombre: "Ayuntamiento", estado: "solicitada", ejercicio: 2025 }],
    subvencion_resumen: [
      { subvencion_id: "sub-1", movimientos: 2, delegaciones: 2, total_gastos: "80.00", total_ingresos: "0" },
    ],
    subvencion_movimiento: [
      { subvencion_id: "sub-1", movimiento_id: "m-2" },
      { subvencion_id: "sub-1", movimiento_id: "m-1" },
    ],
    movimiento: [
      movimiento("m-1", SEV.id, "2026-06-02", -50),
      movimiento("m-2", MAD.id, "2026-06-01", -30),
      movimiento("m-3", SEV.id, "2026-06-03", -10),
    ],
    ...extra,
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function api(t: Tablas) {
  const mod = await import("@/lib/api/subvenciones")
  return { mod, admin: crearFakeAdmin(t) as any }
}

describe("listarSubvenciones", () => {
  it("engancha el resumen y pone ceros a la que no tiene movimientos", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.listarSubvenciones(admin)
    const ivaj = r.subvenciones.find((s) => s.id === "sub-1")!
    expect(ivaj.importe_concedido).toBe(1000)
    expect(ivaj.resumen).toEqual({ movimientos: 2, delegaciones: 2, total_gastos: 80, total_ingresos: 0 })
    expect(r.subvenciones.find((s) => s.id === "sub-2")!.resumen.movimientos).toBe(0)
  })

  it("filtra por estado, ejercicio y texto", async () => {
    const { mod, admin } = await api(tablas())
    expect((await mod.listarSubvenciones(admin, { estados: ["solicitada"] })).subvenciones.map((s) => s.id)).toEqual(["sub-2"])
    expect((await mod.listarSubvenciones(admin, { ejercicio: 2026 })).subvenciones.map((s) => s.id)).toEqual(["sub-1"])
    expect((await mod.listarSubvenciones(admin, { texto: "ayunta" })).subvenciones.map((s) => s.id)).toEqual(["sub-2"])
  })

  it("un estado desconocido dice cuáles valen", async () => {
    const { mod, admin } = await api(tablas())
    await expect(mod.listarSubvenciones(admin, { estados: ["pagada"] })).rejects.toMatchObject({
      status: 400,
      detalles: { estados_validos: expect.arrayContaining(["concedida"]) },
    })
  })
})

describe("obtenerSubvencion", () => {
  it("trae los movimientos de varias delegaciones, por fecha, y no los de fuera", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.obtenerSubvencion(admin, "sub-1", { incluirArchivos: false })
    expect(r.movimiento_ids).toEqual(["m-2", "m-1"])
    expect(r.movimientos!.map((m) => [m.id, m.delegacion?.codigo])).toEqual([
      ["m-2", "MAD"],
      ["m-1", "SEV"],
    ])
  })

  it("con incluirMovimientos: false solo vienen los ids", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.obtenerSubvencion(admin, "sub-1", { incluirMovimientos: false })
    expect(r.movimientos).toBeUndefined()
    expect([...r.movimiento_ids].sort()).toEqual(["m-1", "m-2"])
  })

  it("404 si no existe", async () => {
    const { mod, admin } = await api(tablas())
    await expect(mod.obtenerSubvencion(admin, "nope")).rejects.toMatchObject({ status: 404 })
  })
})
