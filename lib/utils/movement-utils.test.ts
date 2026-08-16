import { describe, it, expect } from "vitest"
import type { Categoria, Cuenta, Movimiento } from "@/lib/types/database"
import {
  enrichMovementsWithData,
  getAccountDisplayName,
  getAccountIcon,
} from "@/lib/utils/movement-utils"
import { buildExpandedCategoryIds } from "@/lib/utils/category-utils"

const cuenta = (over: Partial<Cuenta>): Cuenta => ({ id: "c1", nombre: "Cuenta", ...over }) as Cuenta
const categoria = (over: Partial<Categoria>): Categoria =>
  ({ id: "cat1", nombre: "Categoría", ...over }) as Categoria
const movimiento = (over: Partial<Movimiento>): Movimiento =>
  ({ id: "m1", importe: -10, ...over }) as Movimiento

describe("enrichMovementsWithData", () => {
  const cuentas = [cuenta({ id: "c1", nombre: "Corriente" }), cuenta({ id: "c2", nombre: "Caja" })]
  const categorias = [categoria({ id: "cat1", nombre: "Comida" })]

  it("cruza cada movimiento con su cuenta y su categoría", () => {
    const [enriquecido] = enrichMovementsWithData(
      [movimiento({ cuenta_id: "c2", categoria_id: "cat1" })],
      cuentas,
      categorias,
    )
    expect(enriquecido.cuenta?.nombre).toBe("Caja")
    expect(enriquecido.categoria?.nombre).toBe("Comida")
  })

  it("deja sin cuenta/categoría lo que no encuentra, en vez de fallar", () => {
    const [enriquecido] = enrichMovementsWithData(
      [movimiento({ cuenta_id: "borrada", categoria_id: null })],
      cuentas,
      categorias,
    )
    expect(enriquecido.cuenta).toBeUndefined()
    expect(enriquecido.categoria).toBeUndefined()
  })

  it("conserva todos los campos del movimiento original", () => {
    const original = movimiento({ cuenta_id: "c1", concepto: "Compra", importe: -12.5 })
    const [enriquecido] = enrichMovementsWithData([original], cuentas, categorias)
    expect(enriquecido.concepto).toBe("Compra")
    expect(enriquecido.importe).toBe(-12.5)
  })

  it("con listas vacías devuelve una lista vacía", () => {
    expect(enrichMovementsWithData([], [], [])).toEqual([])
  })
})

describe("getAccountDisplayName / getAccountIcon", () => {
  it("una caja se muestra solo con su nombre", () => {
    expect(getAccountDisplayName(cuenta({ tipo: "caja", nombre: "Caja chica" }))).toBe("Caja chica")
  })

  it("una cuenta de banco antepone el banco cuando se conoce", () => {
    expect(
      getAccountDisplayName(cuenta({ tipo: "banco", banco_nombre: "BBVA", nombre: "Corriente" })),
    ).toBe("BBVA - Corriente")
  })

  it("sin nombre de banco no deja un guion suelto", () => {
    expect(getAccountDisplayName(cuenta({ tipo: "banco", banco_nombre: null, nombre: "Corriente" }))).toBe(
      "Corriente",
    )
  })

  it("el icono distingue banco de efectivo", () => {
    expect(getAccountIcon(cuenta({ tipo: "banco" }))).toBe("🏦")
    expect(getAccountIcon(cuenta({ tipo: "caja" }))).toBe("💵")
  })
})

describe("buildExpandedCategoryIds", () => {
  const categorias = [
    categoria({ id: "padre", categoria_padre_id: null }),
    categoria({ id: "hija-1", categoria_padre_id: "padre" }),
    categoria({ id: "hija-2", categoria_padre_id: "padre" }),
    categoria({ id: "ajena", categoria_padre_id: "otro" }),
  ]

  it("filtrar por una categoría padre arrastra sus hijas", () => {
    expect(buildExpandedCategoryIds(["padre"], categorias).sort()).toEqual([
      "hija-1",
      "hija-2",
      "padre",
    ])
  })

  it("filtrar por una hija no arrastra a nadie más", () => {
    expect(buildExpandedCategoryIds(["hija-1"], categorias)).toEqual(["hija-1"])
  })

  it("no expande en cascada más de un nivel", () => {
    const nietos = [
      categoria({ id: "hija", categoria_padre_id: "padre" }),
      categoria({ id: "nieta", categoria_padre_id: "hija" }),
    ]
    expect(buildExpandedCategoryIds(["padre"], nietos).sort()).toEqual(["hija", "padre"])
  })

  it("no duplica cuando ya se pasa la hija junto al padre", () => {
    const ids = buildExpandedCategoryIds(["padre", "hija-1"], categorias)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("sin selección devuelve lista vacía", () => {
    expect(buildExpandedCategoryIds([], categorias)).toEqual([])
  })
})
