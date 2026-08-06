import { describe, it, expect } from "vitest"
import { sortCategorias } from "@/hooks/use-categorias"
import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"

function categoria(overrides: Partial<CategoriaConOrdenEfectivo>): CategoriaConOrdenEfectivo {
  return {
    id: overrides.id || "cat-1",
    organizacion_id: "org-1",
    delegacion_id: null,
    nombre: "Sin nombre",
    tipo: "mixto",
    emoji: null,
    color: null,
    orden: 0,
    categoria_padre_id: null,
    creado_en: "2026-01-01T00:00:00Z",
    es_global: false,
    esta_activa: true,
    orden_base: 0,
    orden_override: null,
    orden_efectivo: 0,
    esta_activa_override: null,
    esta_activa_efectiva: true,
    has_override: false,
    ...overrides,
  }
}

describe("sortCategorias", () => {
  it("ordena por orden_efectivo ascendente", () => {
    const result = sortCategorias([
      categoria({ id: "a", nombre: "Alquiler", orden_efectivo: 2 }),
      categoria({ id: "b", nombre: "Bienes", orden_efectivo: 0 }),
      categoria({ id: "c", nombre: "Comida", orden_efectivo: 1 }),
    ])
    expect(result.map((c) => c.id)).toEqual(["b", "c", "a"])
  })

  it("desempata alfabéticamente cuando orden_efectivo coincide", () => {
    const result = sortCategorias([
      categoria({ id: "z", nombre: "Zapatos", orden_efectivo: 0 }),
      categoria({ id: "a", nombre: "Agua", orden_efectivo: 0 }),
      categoria({ id: "m", nombre: "Material", orden_efectivo: 0 }),
    ])
    expect(result.map((c) => c.nombre)).toEqual(["Agua", "Material", "Zapatos"])
  })

  it("un override de orden gana sobre el orden base (vía orden_efectivo)", () => {
    // orden_efectivo ya encapsula la resolución override ?? base; aquí
    // caracterizamos que sortCategorias confía ciegamente en ese valor.
    const result = sortCategorias([
      categoria({ id: "a", nombre: "Alquiler", orden_base: 0, orden_override: 5, orden_efectivo: 5 }),
      categoria({ id: "b", nombre: "Bienes", orden_base: 1, orden_override: null, orden_efectivo: 1 }),
    ])
    expect(result.map((c) => c.id)).toEqual(["b", "a"])
  })

  it("no muta el array original", () => {
    const original = [
      categoria({ id: "a", orden_efectivo: 1 }),
      categoria({ id: "b", orden_efectivo: 0 }),
    ]
    const originalOrder = original.map((c) => c.id)
    sortCategorias(original)
    expect(original.map((c) => c.id)).toEqual(originalOrder)
  })

  it("no filtra por esta_activa_efectiva (la visibilidad es responsabilidad del caller)", () => {
    const result = sortCategorias([
      categoria({ id: "a", nombre: "Activa", orden_efectivo: 0, esta_activa_efectiva: true }),
      categoria({ id: "b", nombre: "Inactiva", orden_efectivo: 1, esta_activa_efectiva: false }),
    ])
    expect(result).toHaveLength(2)
  })
})
