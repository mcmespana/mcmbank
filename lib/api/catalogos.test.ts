import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Los catálogos deciden qué ve cada delegación. La API y el MCP usan la clave
 * de servicio y se saltan la RLS, así que el aislamiento entre delegaciones no
 * lo pone Postgres: lo pone este filtro. Que Sevilla nunca vea una cuenta de
 * Madrid se comprueba aquí o no se comprueba en ninguna parte.
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }

const CUENTAS = [
  { id: "cta-sev", delegacion_id: SEV.id, nombre: "Corriente Sevilla", activa: true, iban: "ES9121000418450200051332" },
  { id: "cta-sev-vieja", delegacion_id: SEV.id, nombre: "Antigua Sevilla", activa: false, iban: null },
  { id: "cta-mad", delegacion_id: MAD.id, nombre: "Corriente Madrid", activa: true, iban: null },
]

const CATEGORIAS = [
  { id: "cat-global", nombre: "Alimentación", es_global: true, delegacion_id: null, orden: 1, esta_activa: true },
  { id: "cat-sev", nombre: "Campamento Sevilla", es_global: false, delegacion_id: SEV.id, orden: 2, esta_activa: true },
  { id: "cat-sev-off", nombre: "Antigua", es_global: false, delegacion_id: SEV.id, orden: 3, esta_activa: false },
  { id: "cat-mad", nombre: "Campamento Madrid", es_global: false, delegacion_id: MAD.id, orden: 4, esta_activa: true },
]

const CONTACTOS = [
  { id: "con-global", nombre: "Mercadona", tipo: "proveedor", es_global: true, delegacion_id: null, archivado: false },
  { id: "con-sev", nombre: "Ana Ruiz", tipo: "persona_mcm", es_global: false, delegacion_id: SEV.id, archivado: false },
  { id: "con-sev-arch", nombre: "Antiguo proveedor", tipo: "proveedor", es_global: false, delegacion_id: SEV.id, archivado: true },
  { id: "con-mad", nombre: "Luis Gómez", tipo: "persona_mcm", es_global: false, delegacion_id: MAD.id, archivado: false },
]

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    cuenta: CUENTAS,
    categoria: CATEGORIAS,
    contacto: CONTACTOS,
    categoria_orden_delegacion: [],
    ...extra,
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function cargar(extra: Partial<Tablas> = {}) {
  const mod = await import("@/lib/api/catalogos")
  return { mod, admin: crearFakeAdmin(tablas(extra)) as any }
}

describe("listCuentas", () => {
  it("sin ámbito devuelve las de toda la organización", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.listCuentas(admin)).map((c) => c.id)).toEqual(["cta-mad", "cta-sev"])
  })

  it("con una delegación, solo las suyas", async () => {
    const { mod, admin } = await cargar()
    const cuentas = await mod.listCuentas(admin, { delegaciones: "Sevilla" })
    expect(cuentas.map((c) => c.id)).toEqual(["cta-sev"])
    expect(cuentas.some((c) => c.delegacion_id === MAD.id)).toBe(false)
  })

  it("las inactivas quedan fuera salvo que se pidan", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.listCuentas(admin, { delegaciones: "Sevilla" })).length).toBe(1)
    expect(
      (await mod.listCuentas(admin, { delegaciones: "Sevilla", incluirInactivas: true })).length,
    ).toBe(2)
  })

  it("ordena por nombre con criterio español", async () => {
    const { mod, admin } = await cargar()
    const nombres = (await mod.listCuentas(admin, { incluirInactivas: true })).map((c) => c.nombre)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, "es")))
  })
})

describe("listCategorias", () => {
  it("una delegación ve las globales y las suyas, nunca las de otra", async () => {
    const { mod, admin } = await cargar()
    const ids = (await mod.listCategorias(admin, { delegaciones: "Sevilla" })).map((c) => c.id)
    expect(ids).toContain("cat-global")
    expect(ids).toContain("cat-sev")
    expect(ids).not.toContain("cat-mad")
  })

  it("las desactivadas no salen salvo que se pidan", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.listCategorias(admin, { delegaciones: "Sevilla" })).map((c) => c.id)).not.toContain(
      "cat-sev-off",
    )
    expect(
      (await mod.listCategorias(admin, { delegaciones: "Sevilla", incluirInactivas: true })).map(
        (c) => c.id,
      ),
    ).toContain("cat-sev-off")
  })

  it("aplica el orden propio de la delegación cuando se pide una sola", async () => {
    const { mod, admin } = await cargar({
      categoria_orden_delegacion: [
        { delegacion_id: SEV.id, categoria_id: "cat-sev", orden: 0, esta_activa: true },
      ],
    })
    const ids = (await mod.listCategorias(admin, { delegaciones: "Sevilla" })).map((c) => c.id)
    // El override la sube por delante de la global.
    expect(ids[0]).toBe("cat-sev")
  })

  it("el override de la delegación también puede ocultarla", async () => {
    const { mod, admin } = await cargar({
      categoria_orden_delegacion: [
        { delegacion_id: SEV.id, categoria_id: "cat-global", orden: 1, esta_activa: false },
      ],
    })
    const ids = (await mod.listCategorias(admin, { delegaciones: "Sevilla" })).map((c) => c.id)
    expect(ids).not.toContain("cat-global")
  })

  it("con varias delegaciones no se aplica ningún override (no tendría sentido)", async () => {
    const { mod, admin } = await cargar({
      categoria_orden_delegacion: [
        { delegacion_id: SEV.id, categoria_id: "cat-global", orden: 1, esta_activa: false },
      ],
    })
    const ids = (await mod.listCategorias(admin, { delegaciones: ["Sevilla", "Madrid"] })).map(
      (c) => c.id,
    )
    expect(ids).toContain("cat-global")
  })
})

describe("listContactos", () => {
  it("incluye los proveedores globales junto a los propios", async () => {
    const { mod, admin } = await cargar()
    const ids = (await mod.listContactos(admin, { delegaciones: "Sevilla" })).map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(["con-global", "con-sev"]))
    expect(ids).not.toContain("con-mad")
  })

  it("los archivados no salen salvo que se pidan", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.listContactos(admin, { delegaciones: "Sevilla" })).map((c) => c.id)).not.toContain(
      "con-sev-arch",
    )
    expect(
      (await mod.listContactos(admin, { delegaciones: "Sevilla", incluirArchivados: true })).map(
        (c) => c.id,
      ),
    ).toContain("con-sev-arch")
  })

  it("filtra por tipo", async () => {
    const { mod, admin } = await cargar()
    const personas = await mod.listContactos(admin, { tipos: ["persona_mcm"] })
    expect(personas.map((c) => c.id).sort()).toEqual(["con-mad", "con-sev"])
  })

  it("busca por texto sin distinguir mayúsculas", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.listContactos(admin, { texto: "MERCA" })).map((c) => c.id)).toEqual([
      "con-global",
    ])
  })

  it("el filtro de texto se combina con el de delegación", async () => {
    const { mod, admin } = await cargar()
    expect(
      (await mod.listContactos(admin, { delegaciones: "Sevilla", texto: "Luis" })).length,
    ).toBe(0)
  })
})

describe("resolveCategorias", () => {
  it("sin entrada devuelve null (sin filtro)", async () => {
    const { mod, admin } = await cargar()
    expect(await mod.resolveCategorias(admin, null)).toBeNull()
    expect(await mod.resolveCategorias(admin, [])).toBeNull()
    expect(await mod.resolveCategorias(admin, ["  "])).toBeNull()
  })

  it("resuelve por id, por nombre exacto y por parte del nombre", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.resolveCategorias(admin, "cat-sev"))!.map((c) => c.id)).toEqual(["cat-sev"])
    expect((await mod.resolveCategorias(admin, "alimentación"))!.map((c) => c.id)).toEqual([
      "cat-global",
    ])
    expect((await mod.resolveCategorias(admin, "Campamento"))!.map((c) => c.id).sort()).toEqual([
      "cat-mad",
      "cat-sev",
    ])
  })

  it("el nombre exacto gana a la coincidencia parcial", async () => {
    const { mod, admin } = await cargar({
      categoria: [
        ...CATEGORIAS,
        { id: "cat-exacta", nombre: "Campamento", es_global: true, delegacion_id: null, orden: 9, esta_activa: true },
      ],
    })
    expect((await mod.resolveCategorias(admin, "Campamento"))!.map((c) => c.id)).toEqual([
      "cat-exacta",
    ])
  })

  it("respeta el ámbito: no resuelve una categoría de otra delegación", async () => {
    const { mod, admin } = await cargar()
    const encontradas = await mod.resolveCategorias(admin, "Campamento Madrid", [SEV])
    expect(encontradas).toEqual([])
  })

  it("no repite una categoría que casa con dos términos", async () => {
    const { mod, admin } = await cargar()
    const encontradas = await mod.resolveCategorias(admin, ["Alimentación", "aliment"])
    expect(encontradas!.map((c) => c.id)).toEqual(["cat-global"])
  })
})

describe("resolveCuentas", () => {
  it("resuelve por id, nombre parcial e IBAN", async () => {
    const { mod, admin } = await cargar()
    expect((await mod.resolveCuentas(admin, "cta-mad"))!.map((c) => c.id)).toEqual(["cta-mad"])
    expect((await mod.resolveCuentas(admin, "corriente sevilla"))!.map((c) => c.id)).toEqual([
      "cta-sev",
    ])
    expect((await mod.resolveCuentas(admin, "ES91 2100 0418 4502 0005 1332"))!.map((c) => c.id)).toEqual(
      ["cta-sev"],
    )
  })

  it("no cruza el ámbito de delegaciones", async () => {
    const { mod, admin } = await cargar()
    expect(await mod.resolveCuentas(admin, "Corriente Madrid", [SEV])).toEqual([])
  })

  it("sin entrada, null", async () => {
    const { mod, admin } = await cargar()
    expect(await mod.resolveCuentas(admin, undefined)).toBeNull()
  })
})

describe("caché de catálogos", () => {
  it("no vuelve a consultar en llamadas seguidas, y forzarRecarga sí", async () => {
    const { mod, admin } = await cargar()
    await mod.cargarCatalogos(admin)
    const tras1 = admin.consultas.length
    await mod.cargarCatalogos(admin)
    expect(admin.consultas.length).toBe(tras1)

    await mod.cargarCatalogos(admin, { forzarRecarga: true })
    expect(admin.consultas.length).toBeGreaterThan(tras1)
  })
})
