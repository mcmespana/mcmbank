import { describe, it, expect } from "vitest"
import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"
import {
  canEditCategory,
  canDeleteCategory,
  canToggleCategoryActive,
  canHideGlobalCategory,
  canReorderCategory,
  canCreateSubcategory,
  type CategoryPermissionContext,
} from "./category-permissions"

const DELEG = "deleg-1"
const OTRA_DELEG = "deleg-2"

/** Crea una categoría mínima; solo importan es_global, delegacion_id y padre. */
function cat(overrides: Partial<CategoriaConOrdenEfectivo> = {}): CategoriaConOrdenEfectivo {
  return {
    es_global: false,
    delegacion_id: DELEG,
    categoria_padre_id: null,
    ...overrides,
  } as CategoriaConOrdenEfectivo
}

const gestor: CategoryPermissionContext = {
  isCentralManager: true,
  isDelegationTreasurer: false,
  selectedDelegation: DELEG,
}
const tesorero: CategoryPermissionContext = {
  isCentralManager: false,
  isDelegationTreasurer: true,
  selectedDelegation: DELEG,
}
const sinDelegacion: CategoryPermissionContext = {
  isCentralManager: false,
  isDelegationTreasurer: true,
  selectedDelegation: null,
}

describe("canEditCategory", () => {
  it("el gestor central puede editar cualquier categoría", () => {
    expect(canEditCategory(gestor, cat({ es_global: true }))).toBe(true)
    expect(canEditCategory(gestor, cat({ es_global: false }))).toBe(true)
  })

  it("el tesorero solo edita categorías locales de su delegación", () => {
    expect(canEditCategory(tesorero, cat({ es_global: false, delegacion_id: DELEG }))).toBe(true)
    expect(canEditCategory(tesorero, cat({ es_global: true }))).toBe(false)
    expect(canEditCategory(tesorero, cat({ delegacion_id: OTRA_DELEG }))).toBe(false)
  })

  it("sin delegación seleccionada el tesorero no puede editar", () => {
    expect(canEditCategory(sinDelegacion, cat())).toBe(false)
  })
})

describe("canDeleteCategory", () => {
  it("coincide con los permisos de edición (gestor todo, tesorero solo local)", () => {
    expect(canDeleteCategory(gestor, cat({ es_global: true }))).toBe(true)
    expect(canDeleteCategory(tesorero, cat({ es_global: false, delegacion_id: DELEG }))).toBe(true)
    expect(canDeleteCategory(tesorero, cat({ es_global: true }))).toBe(false)
  })
})

describe("canToggleCategoryActive", () => {
  it("el gestor solo activa/desactiva globales", () => {
    expect(canToggleCategoryActive(gestor, cat({ es_global: true }))).toBe(true)
    expect(canToggleCategoryActive(gestor, cat({ es_global: false }))).toBe(false)
  })

  it("el tesorero activa/desactiva sus categorías locales", () => {
    expect(canToggleCategoryActive(tesorero, cat({ delegacion_id: DELEG }))).toBe(true)
    expect(canToggleCategoryActive(tesorero, cat({ es_global: true }))).toBe(false)
  })
})

describe("canHideGlobalCategory", () => {
  it("solo el tesorero puede ocultar globales en su delegación", () => {
    expect(canHideGlobalCategory(tesorero, cat({ es_global: true }))).toBe(true)
    expect(canHideGlobalCategory(tesorero, cat({ es_global: false }))).toBe(false)
  })

  it("el gestor central no oculta (desactiva directamente)", () => {
    expect(canHideGlobalCategory(gestor, cat({ es_global: true }))).toBe(false)
  })
})

describe("canReorderCategory", () => {
  it("siempre permitido", () => {
    expect(canReorderCategory()).toBe(true)
  })
})

describe("canCreateSubcategory", () => {
  it("no permite subcategorías de una subcategoría", () => {
    expect(canCreateSubcategory(gestor, cat({ categoria_padre_id: "padre-1" }))).toBe(false)
  })

  it("cualquiera crea subcategorías bajo categorías locales de primer nivel", () => {
    expect(canCreateSubcategory(tesorero, cat({ es_global: false }))).toBe(true)
  })

  it("bajo categorías globales: gestor sí; tesorero con delegación sí; sin delegación no", () => {
    expect(canCreateSubcategory(gestor, cat({ es_global: true }))).toBe(true)
    expect(canCreateSubcategory(tesorero, cat({ es_global: true }))).toBe(true)
    expect(canCreateSubcategory(sinDelegacion, cat({ es_global: true }))).toBe(false)
  })
})
