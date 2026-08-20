import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Pagos MCM (reembolsos a personas del movimiento). La API solo los lee, así
 * que lo que hay que comprobar es la paginación, el filtrado por delegación
 * /estado/contacto y que la ficha que se devuelve trae bien enganchados el
 * contacto y la categoría sugerida — igual que `resumen.ts`, los catálogos y
 * las delegaciones se cachean 60 s a nivel de módulo, así que cada test
 * recarga los módulos.
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }
const CONTACTO = { id: "con-1", nombre: "Ana Pérez", tipo: "persona_mcm", es_global: false, delegacion_id: SEV.id }
const CATEGORIA = { id: "cat-1", nombre: "Kilometraje", es_global: true, delegacion_id: null, orden: 1, esta_activa: true }

let pago = 0
function pagoMcm(over: Record<string, any> = {}) {
  return {
    id: `pago-${++pago}`,
    delegacion_id: SEV.id,
    concepto: "Kilometraje octubre",
    descripcion: null,
    importe: 25.5,
    moneda: "EUR",
    estado: "pendiente",
    tipo_calculo: "km",
    contacto_id: null,
    categoria_id_sugerida: null,
    movimiento_id: null,
    notas: null,
    creado_en: "2026-03-01T00:00:00Z",
    actualizado_en: "2026-03-01T00:00:00Z",
    ...over,
  }
}

function tablas(pagos: Record<string, any>[], extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    cuenta: [],
    categoria: [CATEGORIA],
    contacto: [CONTACTO],
    pago_mcm: pagos,
    ...extra,
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function api(t: Tablas) {
  const mod = await import("@/lib/api/pagos")
  return { mod, admin: crearFakeAdmin(t) as any }
}

describe("listarPagosMcm · serialización", () => {
  it("engancha delegación, contacto y categoría sugerida", async () => {
    const { mod, admin } = await api(
      tablas([pagoMcm({ contacto_id: CONTACTO.id, categoria_id_sugerida: CATEGORIA.id })]),
    )
    const res = await mod.listarPagosMcm(admin)
    expect(res.pagos[0].delegacion).toEqual(SEV)
    expect(res.pagos[0].contacto).toEqual({ id: CONTACTO.id, nombre: CONTACTO.nombre, tipo: CONTACTO.tipo })
    expect(res.pagos[0].categoria_sugerida).toEqual({ id: CATEGORIA.id, nombre: CATEGORIA.nombre })
  })

  it("sin contacto ni categoría, null en vez de undefined", async () => {
    const { mod, admin } = await api(tablas([pagoMcm()]))
    const res = await mod.listarPagosMcm(admin)
    expect(res.pagos[0].contacto).toBeNull()
    expect(res.pagos[0].categoria_sugerida).toBeNull()
  })

  it("el importe siempre sale como número, aunque llegue como texto", async () => {
    const { mod, admin } = await api(tablas([pagoMcm({ importe: "25.50" as any })]))
    const res = await mod.listarPagosMcm(admin)
    expect(res.pagos[0].importe).toBe(25.5)
  })
})

describe("listarPagosMcm · paginación", () => {
  it("por defecto trae 50 y empieza en offset 0", async () => {
    const { mod, admin } = await api(tablas([]))
    const res = await mod.listarPagosMcm(admin)
    expect(res.limite).toBe(50)
    expect(res.offset).toBe(0)
  })

  it("el límite se acota a 200 aunque se pida más", async () => {
    const { mod, admin } = await api(tablas([]))
    const res = await mod.listarPagosMcm(admin, { limite: 5000 })
    expect(res.limite).toBe(200)
  })

  it("el límite mínimo es 1, no 0 ni negativo", async () => {
    const { mod, admin } = await api(tablas([]))
    const res = await mod.listarPagosMcm(admin, { limite: -10 })
    expect(res.limite).toBe(1)
  })

  it("un offset negativo se corrige a 0", async () => {
    const { mod, admin } = await api(tablas([]))
    const res = await mod.listarPagosMcm(admin, { offset: -5 })
    expect(res.offset).toBe(0)
  })

  it("el total cuenta todo lo que casa, no solo la página devuelta", async () => {
    const pagos = Array.from({ length: 3 }, () => pagoMcm())
    const { mod, admin } = await api(tablas(pagos))
    const res = await mod.listarPagosMcm(admin, { limite: 1 })
    expect(res.total).toBe(3)
    expect(res.pagos).toHaveLength(1)
  })
})

describe("listarPagosMcm · filtros", () => {
  it("filtra por delegación", async () => {
    const { mod, admin } = await api(
      tablas([pagoMcm({ id: "p-sev" }), pagoMcm({ id: "p-mad", delegacion_id: MAD.id })]),
    )
    const res = await mod.listarPagosMcm(admin, { delegaciones: "Sevilla" })
    expect(res.pagos.map((p: any) => p.id)).toEqual(["p-sev"])
  })

  it("filtra por estado", async () => {
    const { mod, admin } = await api(
      tablas([pagoMcm({ id: "p-pend", estado: "pendiente" }), pagoMcm({ id: "p-pag", estado: "pagado" })]),
    )
    const res = await mod.listarPagosMcm(admin, { estados: ["pagado"] })
    expect(res.pagos.map((p: any) => p.id)).toEqual(["p-pag"])
  })

  it("filtra por contacto", async () => {
    const { mod, admin } = await api(
      tablas([
        pagoMcm({ id: "p-ana", contacto_id: CONTACTO.id }),
        pagoMcm({ id: "p-otro", contacto_id: "con-2" }),
      ]),
    )
    const res = await mod.listarPagosMcm(admin, { contactoIds: [CONTACTO.id] })
    expect(res.pagos.map((p: any) => p.id)).toEqual(["p-ana"])
  })

  it("sin filtro de delegación devuelve las de todas", async () => {
    const { mod, admin } = await api(
      tablas([pagoMcm({ id: "p-sev" }), pagoMcm({ id: "p-mad", delegacion_id: MAD.id })]),
    )
    const res = await mod.listarPagosMcm(admin)
    expect(res.pagos.map((p: any) => p.id).sort()).toEqual(["p-mad", "p-sev"])
  })
})
