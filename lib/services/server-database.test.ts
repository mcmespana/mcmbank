import { describe, it, expect, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * `ServerDatabaseService`, versión servidor de `DatabaseService`. El corazón
 * es `getCategoriasByDelegacion`: calcula el orden y la visibilidad
 * *efectivos* de cada categoría combinando la ficha global con el override
 * de la delegación (`categoria_orden_delegacion`) — el mismo cálculo que
 * describe `CategoriaConOrdenEfectivo` en CLAUDE.md. Una categoría con override
 * de orden pero SIN cambio real de valor no debe contarse como "distinta", y
 * el `has_override` tiene que seguir siendo true aunque no cambie nada visible.
 *
 * El `select` real trae los overrides embebidos
 * (`overrides:categoria_orden_delegacion!left(...)`), algo que el
 * `fake-admin` no simula (no hace joins) — así que las filas de prueba ya
 * llevan la propiedad `overrides` puesta a mano, exactamente como llegaría
 * de Postgres.
 */

let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => fakeAdmin,
}))

const DEL_A = "del-a"

function categoria(over: Record<string, any> = {}) {
  return {
    id: "cat-1",
    nombre: "Alimentación",
    tipo: "gasto",
    emoji: null,
    color: null,
    es_global: true,
    delegacion_id: null,
    categoria_padre_id: null,
    orden: 5,
    esta_activa: true,
    overrides: [],
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { categoria: [], categoria_orden_delegacion: [], membresia: [], delegacion: [], cuenta: [], ...extra }
}

async function servicio(t: Tablas = tablas()) {
  fakeAdmin = crearFakeAdmin(t) as any
  const { ServerDatabaseService } = await import("@/lib/services/server-database")
  return ServerDatabaseService
}

describe("getCategoriasByDelegacion · orden y visibilidad efectivos", () => {
  it("sin override, el orden y la visibilidad son los de la propia categoría", async () => {
    const Servicio = await servicio(tablas({ categoria: [categoria()] }))
    const [c] = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(c.orden_efectivo).toBe(5)
    expect(c.esta_activa_efectiva).toBe(true)
    expect(c.has_override).toBe(false)
  })

  it("un override con un orden distinto manda sobre el de la categoría", async () => {
    const Servicio = await servicio(
      tablas({ categoria: [categoria({ overrides: [{ delegacion_id: DEL_A, orden: 2, esta_activa: true }] })] }),
    )
    const [c] = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(c.orden_efectivo).toBe(2)
    expect(c.has_override).toBe(true)
  })

  it("un override con el MISMO orden no se cuenta como cambio, pero has_override sigue siendo true", async () => {
    const Servicio = await servicio(
      tablas({ categoria: [categoria({ orden: 5, overrides: [{ delegacion_id: DEL_A, orden: 5, esta_activa: true }] })] }),
    )
    const [c] = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(c.orden_override).toBeNull()
    expect(c.orden_efectivo).toBe(5)
    expect(c.has_override).toBe(true)
  })

  it("el override de visibilidad de OTRA delegación no afecta a esta", async () => {
    const Servicio = await servicio(
      tablas({ categoria: [categoria({ overrides: [{ delegacion_id: "otra-delegacion", esta_activa: false, orden: 5 }] })] }),
    )
    const [c] = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(c.esta_activa_efectiva).toBe(true)
    expect(c.has_override).toBe(false)
  })

  it("un override que la oculta gana a que la categoría esté activa por defecto", async () => {
    const Servicio = await servicio(
      tablas({ categoria: [categoria({ overrides: [{ delegacion_id: DEL_A, esta_activa: false, orden: 5 }] })] }),
    )
    const [c] = await Servicio.getCategoriasByDelegacion(DEL_A, { includeInactive: true })
    expect(c.esta_activa_efectiva).toBe(false)
  })

  it("por defecto, las inactivas (efectivas) no se devuelven", async () => {
    const Servicio = await servicio(
      tablas({
        categoria: [
          categoria({ id: "cat-activa" }),
          categoria({ id: "cat-oculta", overrides: [{ delegacion_id: DEL_A, esta_activa: false, orden: 5 }] }),
        ],
      }),
    )
    const lista = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(lista.map((c) => c.id)).toEqual(["cat-activa"])
  })

  it("con includeInactive, también salen las ocultas por override", async () => {
    const Servicio = await servicio(
      tablas({ categoria: [categoria({ overrides: [{ delegacion_id: DEL_A, esta_activa: false, orden: 5 }] })] }),
    )
    const lista = await Servicio.getCategoriasByDelegacion(DEL_A, { includeInactive: true })
    expect(lista).toHaveLength(1)
  })

  it("ordena por orden_efectivo y desempata por nombre", async () => {
    const Servicio = await servicio(
      tablas({
        categoria: [
          categoria({ id: "c-b", nombre: "Bebidas", orden: 1 }),
          categoria({ id: "c-a", nombre: "Agua", orden: 1 }),
          categoria({ id: "c-z", nombre: "Zapatos", orden: 0 }),
        ],
      }),
    )
    const lista = await Servicio.getCategoriasByDelegacion(DEL_A)
    expect(lista.map((c) => c.id)).toEqual(["c-z", "c-a", "c-b"])
  })

  it("sin delegación y sin pedir globales, no consulta nada y devuelve vacío", async () => {
    const Servicio = await servicio(tablas({ categoria: [categoria()] }))
    const lista = await Servicio.getCategoriasByDelegacion(null, { includeGlobal: false })
    expect(lista).toEqual([])
    expect(fakeAdmin.consultas).toHaveLength(0)
  })

  it("sin delegación pero con includeGlobal, solo trae las globales", async () => {
    const Servicio = await servicio(
      tablas({
        categoria: [categoria({ id: "global", es_global: true }), categoria({ id: "propia", es_global: false, delegacion_id: "otra" })],
      }),
    )
    const lista = await Servicio.getCategoriasByDelegacion(null)
    expect(lista.map((c) => c.id)).toEqual(["global"])
  })
})

describe("otras operaciones de solo lectura", () => {
  it("getUserMemberships filtra por usuario", async () => {
    const Servicio = await servicio(
      tablas({
        membresia: [
          { id: "m1", usuario_id: "user-1", delegacion_id: DEL_A, rol: "tesorero" },
          { id: "m2", usuario_id: "user-2", delegacion_id: DEL_A, rol: "tesorero" },
        ],
      }),
    )
    const membresias = await Servicio.getUserMemberships("user-1")
    expect(membresias.map((m: any) => m.id)).toEqual(["m1"])
  })

  it("getDelegacionById devuelve null si no existe, en vez de lanzar", async () => {
    const Servicio = await servicio()
    expect(await Servicio.getDelegacionById("no-existe")).toBeNull()
  })

  it("getDelegacionById devuelve la fila si existe", async () => {
    const Servicio = await servicio(tablas({ delegacion: [{ id: "del-a", nombre: "Sevilla" }] }))
    const delegacion = await Servicio.getDelegacionById("del-a")
    expect(delegacion?.nombre).toBe("Sevilla")
  })
})

describe("escritura del orden/visibilidad por delegación", () => {
  it("setDelegacionCategoryOrder crea el override", async () => {
    const Servicio = await servicio()
    await Servicio.setDelegacionCategoryOrder(DEL_A, "cat-1", 3)
    expect(fakeAdmin.tablas.categoria_orden_delegacion[0]).toMatchObject({
      delegacion_id: DEL_A,
      categoria_id: "cat-1",
      orden: 3,
    })
  })

  it("setDelegacionCategoryVisibility crea el override de visibilidad", async () => {
    const Servicio = await servicio()
    await Servicio.setDelegacionCategoryVisibility(DEL_A, "cat-1", false, 7)
    expect(fakeAdmin.tablas.categoria_orden_delegacion[0]).toMatchObject({ esta_activa: false, orden: 7 })
  })

  it("clearDelegacionCategoryOrder borra el override existente", async () => {
    const Servicio = await servicio(
      tablas({ categoria_orden_delegacion: [{ delegacion_id: DEL_A, categoria_id: "cat-1", orden: 3 }] }),
    )
    await Servicio.clearDelegacionCategoryOrder(DEL_A, "cat-1")
    expect(fakeAdmin.tablas.categoria_orden_delegacion).toHaveLength(0)
  })
})
