import { describe, it, expect } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"
import { upsertCategoriaOrden, upsertCategoriaVisibilidad } from "@/lib/services/categoria-queries"

/**
 * Upsert atómico del override por delegación de una categoría. Lo importante
 * es justo eso, "atómico": crear la fila si no existía y, si ya existía,
 * tocar solo el campo que se ha pedido sin arrastrarse el resto a un valor
 * por defecto.
 */

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { categoria_orden_delegacion: [], ...extra }
}

describe("upsertCategoriaOrden", () => {
  it("crea la fila si no existía", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    await upsertCategoriaOrden(admin, { delegacionId: "del-1", categoriaId: "cat-1", orden: 3 })
    expect(admin.tablas.categoria_orden_delegacion[0]).toMatchObject({
      delegacion_id: "del-1",
      categoria_id: "cat-1",
      orden: 3,
    })
  })

  it("si ya existía, solo cambia el orden y deja esta_activa como estaba", async () => {
    const admin = crearFakeAdmin(
      tablas({
        categoria_orden_delegacion: [
          { delegacion_id: "del-1", categoria_id: "cat-1", orden: 1, esta_activa: false },
        ],
      }),
    ) as any
    await upsertCategoriaOrden(admin, { delegacionId: "del-1", categoriaId: "cat-1", orden: 9 })
    expect(admin.tablas.categoria_orden_delegacion).toHaveLength(1)
    expect(admin.tablas.categoria_orden_delegacion[0]).toMatchObject({ orden: 9, esta_activa: false })
  })

  it("propaga el error si la escritura falla", async () => {
    const admin = crearFakeAdmin(tablas(), {
      errores: { categoria_orden_delegacion: { message: "fallo simulado" } },
    }) as any
    await expect(
      upsertCategoriaOrden(admin, { delegacionId: "del-1", categoriaId: "cat-1", orden: 1 }),
    ).rejects.toThrow()
  })
})

describe("upsertCategoriaVisibilidad", () => {
  it("crea la fila con el orden de respaldo si no existía", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    await upsertCategoriaVisibilidad(admin, {
      delegacionId: "del-1",
      categoriaId: "cat-1",
      estaActiva: false,
      ordenFallback: 5,
    })
    expect(admin.tablas.categoria_orden_delegacion[0]).toMatchObject({ esta_activa: false, orden: 5 })
  })

  it("si ya existía con un orden distinto, el fallback no se lo pisa (el caller manda el actual)", async () => {
    const admin = crearFakeAdmin(
      tablas({
        categoria_orden_delegacion: [
          { delegacion_id: "del-1", categoria_id: "cat-1", orden: 7, esta_activa: true },
        ],
      }),
    ) as any
    // El caller pasa el orden efectivo actual (7) como fallback: no lo cambia.
    await upsertCategoriaVisibilidad(admin, {
      delegacionId: "del-1",
      categoriaId: "cat-1",
      estaActiva: false,
      ordenFallback: 7,
    })
    expect(admin.tablas.categoria_orden_delegacion[0]).toMatchObject({ orden: 7, esta_activa: false })
  })
})
