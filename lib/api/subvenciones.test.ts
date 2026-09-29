import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Subvenciones desde la API: la ficha con su resumen, y los movimientos
 * imputados de varias delegaciones. Los catálogos se cachean a nivel de
 * módulo, así que cada test recarga los módulos (ver pagos.test.ts).
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }

const F_IVAJ = { id: "fin-1", nombre: "GVA IVAJ", ambito: "autonomico", orden: 1 }

const SUB = {
  id: "11111111-0000-0000-0000-000000000001",
  nombre: "IVAJ 2026",
  financiador_id: "fin-1",
  financiador: F_IVAJ,
  codigo: "IVAJ",
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
    subvencion: [SUB, { ...SUB, id: "11111111-0000-0000-0000-000000000002", nombre: "Ayuntamiento", codigo: "AYTO", estado: "solicitada", ejercicio: 2025 }],
    subvencion_resumen: [
      { subvencion_id: "11111111-0000-0000-0000-000000000001", movimientos: 2, delegaciones: 2, total_gastos: "80.00", total_ingresos: "0", movimientos_parciales: 0 },
    ],
    subvencion_movimiento: [
      { subvencion_id: "11111111-0000-0000-0000-000000000001", movimiento_id: "22222222-0000-0000-0000-000000000002", importe_imputado: "30.00" },
      { subvencion_id: "11111111-0000-0000-0000-000000000001", movimiento_id: "22222222-0000-0000-0000-000000000001", importe_imputado: "20.00" },
    ],
    movimiento: [
      movimiento("22222222-0000-0000-0000-000000000001", SEV.id, "2026-06-02", -50),
      movimiento("22222222-0000-0000-0000-000000000002", MAD.id, "2026-06-01", -30),
      movimiento("22222222-0000-0000-0000-000000000003", SEV.id, "2026-06-03", -10),
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
    const ivaj = r.subvenciones.find((s) => s.id === "11111111-0000-0000-0000-000000000001")!
    expect(ivaj.importe_concedido).toBe(1000)
    expect(ivaj.resumen).toEqual({ movimientos: 2, delegaciones: 2, total_gastos: 80, total_ingresos: 0, movimientos_parciales: 0 })
    expect(ivaj.financiador?.nombre).toBe("GVA IVAJ")
    expect(r.subvenciones.find((s) => s.id === "11111111-0000-0000-0000-000000000002")!.resumen.movimientos).toBe(0)
  })

  it("filtra por estado, ejercicio y texto", async () => {
    const { mod, admin } = await api(tablas())
    expect((await mod.listarSubvenciones(admin, { estados: ["solicitada"] })).subvenciones.map((s) => s.id)).toEqual(["11111111-0000-0000-0000-000000000002"])
    expect((await mod.listarSubvenciones(admin, { ejercicio: 2026 })).subvenciones.map((s) => s.id)).toEqual(["11111111-0000-0000-0000-000000000001"])
    expect((await mod.listarSubvenciones(admin, { texto: "ayunta" })).subvenciones.map((s) => s.id)).toEqual(["11111111-0000-0000-0000-000000000002"])
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
  it("trae los movimientos de varias delegaciones, por fecha, con su parte, y no los de fuera", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.obtenerSubvencion(admin, "11111111-0000-0000-0000-000000000001", { incluirArchivos: false })
    expect(r.movimientos!.map((m) => m.importe_imputado)).toEqual([30, 20])
    expect(r.movimiento_ids).toEqual(["22222222-0000-0000-0000-000000000002", "22222222-0000-0000-0000-000000000001"])
    expect(r.movimientos!.map((m) => [m.id, m.delegacion?.codigo])).toEqual([
      ["22222222-0000-0000-0000-000000000002", "MAD"],
      ["22222222-0000-0000-0000-000000000001", "SEV"],
    ])
  })

  it("con incluirMovimientos: false solo vienen los ids", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.obtenerSubvencion(admin, "11111111-0000-0000-0000-000000000001", { incluirMovimientos: false })
    expect(r.movimientos).toBeUndefined()
    expect([...r.movimiento_ids].sort()).toEqual(["22222222-0000-0000-0000-000000000001", "22222222-0000-0000-0000-000000000002"])
  })

  it("404 si no existe, 400 si el id no es un uuid", async () => {
    const { mod, admin } = await api(tablas())
    await expect(mod.obtenerSubvencion(admin, "11111111-0000-0000-0000-00000000dead")).rejects.toMatchObject({ status: 404 })
    await expect(mod.obtenerSubvencion(admin, "IVAJ")).rejects.toMatchObject({ status: 400 })
  })
})

describe("imputarMovimientosSubvencion", () => {
  it("crea por importe o porcentaje, actualiza lo que ya estaba y dice qué no existe", async () => {
    const t = tablas()
    const { mod, admin } = await api(t)
    const r = await mod.imputarMovimientosSubvencion(
      admin,
      "11111111-0000-0000-0000-000000000002",
      [
        { id: "22222222-0000-0000-0000-000000000001", porcentaje: 50 },
        { id: "22222222-0000-0000-0000-000000000003", importe: -4 },
        { id: "22222222-0000-0000-0000-00000000beef" },
      ],
      "user-1",
    )
    expect(r.imputados).toEqual([
      { movimiento_id: "22222222-0000-0000-0000-000000000001", importe_imputado: 25, accion: "creado" },
      { movimiento_id: "22222222-0000-0000-0000-000000000003", importe_imputado: 4, accion: "creado" },
    ])
    expect(r.errores).toEqual([{ movimiento_id: "22222222-0000-0000-0000-00000000beef", error: "No existe ningún movimiento con este id." }])

    const r2 = await mod.imputarMovimientosSubvencion(admin, "11111111-0000-0000-0000-000000000001", [{ id: "22222222-0000-0000-0000-000000000001", importe: 15 }, { id: "22222222-0000-0000-0000-000000000002" }], "user-1")
    expect(r2.imputados).toEqual([{ movimiento_id: "22222222-0000-0000-0000-000000000001", importe_imputado: 15, accion: "actualizado" }])
    expect(r2.errores[0].movimiento_id).toBe("22222222-0000-0000-0000-000000000002")
  })

  it("rechaza un porcentaje fuera de rango sin tocar nada", async () => {
    const { mod, admin } = await api(tablas())
    const r = await mod.imputarMovimientosSubvencion(admin, "11111111-0000-0000-0000-000000000002", [{ id: "22222222-0000-0000-0000-000000000001", porcentaje: 120 }], "u")
    expect(r.imputados).toEqual([])
    expect(r.errores[0].error).toMatch(/entre 0 y 100/)
  })

  it("quitar solo quita de esa subvención", async () => {
    const t = tablas()
    const { mod, admin } = await api(t)
    const r = await mod.quitarMovimientosSubvencion(admin, "11111111-0000-0000-0000-000000000001", ["22222222-0000-0000-0000-000000000001"])
    expect(r.quitados).toEqual(["22222222-0000-0000-0000-000000000001"])
    expect(t.subvencion_movimiento.map((f) => f.movimiento_id)).toEqual(["22222222-0000-0000-0000-000000000002"])
  })
})
