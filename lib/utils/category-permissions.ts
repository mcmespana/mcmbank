import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"

/**
 * Contexto del usuario necesario para decidir permisos sobre categorías.
 * Se extrae de los hooks de rol/admin y de la delegación seleccionada.
 */
export interface CategoryPermissionContext {
  isCentralManager: boolean
  isDelegationTreasurer: boolean
  selectedDelegation: string | null
}

/**
 * Puede EDITAR (nombre, emoji, color) una categoría.
 * - Gestor MCM: cualquier categoría (global o local).
 * - Tesorero: solo categorías locales de su delegación.
 */
export function canEditCategory(
  ctx: CategoryPermissionContext,
  category: CategoriaConOrdenEfectivo
): boolean {
  if (ctx.isCentralManager) return true
  if (!ctx.selectedDelegation) return false
  return !category.es_global && category.delegacion_id === ctx.selectedDelegation
}

/**
 * Puede ELIMINAR una categoría (borrado físico).
 * - Gestor MCM: cualquier categoría.
 * - Tesorero: solo categorías locales de su delegación.
 */
export function canDeleteCategory(
  ctx: CategoryPermissionContext,
  category: CategoriaConOrdenEfectivo
): boolean {
  if (ctx.isCentralManager) return true
  if (!ctx.selectedDelegation) return false
  return !category.es_global && category.delegacion_id === ctx.selectedDelegation
}

/**
 * Puede ACTIVAR/DESACTIVAR una categoría LOCAL (cambiar su esta_activa).
 * - Las categorías GLOBALES no tienen desactivación global: una global no se puede
 *   ocultar "para todos" (si sobra, se borra). Su visibilidad se gestiona por
 *   delegación con canHideGlobalCategory.
 * - Las categorías locales pertenecen a una delegación, así que su esta_activa ya
 *   es de hecho por delegación: las activa/desactiva el tesorero de esa delegación.
 */
export function canToggleCategoryActive(
  ctx: CategoryPermissionContext,
  category: CategoriaConOrdenEfectivo
): boolean {
  if (category.es_global) return false
  if (ctx.isCentralManager) return false
  if (!ctx.selectedDelegation) return false
  return category.delegacion_id === ctx.selectedDelegation
}

/**
 * Puede OCULTAR/MOSTRAR una categoría global en la delegación seleccionada
 * (override de visibilidad POR DELEGACIÓN, no global).
 * - Solo aplica a categorías globales y con una delegación seleccionada.
 * - Lo pueden hacer tanto el tesorero (en su delegación) como el gestor central
 *   (que desactiva una global para UNA delegación concreta, nunca a nivel global).
 */
export function canHideGlobalCategory(
  ctx: CategoryPermissionContext,
  category: CategoriaConOrdenEfectivo
): boolean {
  if (!ctx.selectedDelegation) return false
  return category.es_global
}

/** Reordenar está permitido siempre. */
export function canReorderCategory(): boolean {
  return true
}

/**
 * Puede CREAR una subcategoría bajo la categoría dada.
 * - Solo categorías de primer nivel admiten subcategorías.
 * - Categorías locales: siempre.
 * - Categorías globales: Gestor MCM, o tesorero con delegación seleccionada.
 */
export function canCreateSubcategory(
  ctx: CategoryPermissionContext,
  category: CategoriaConOrdenEfectivo
): boolean {
  if (category.categoria_padre_id !== null) return false
  if (!category.es_global) return true
  return ctx.isCentralManager || (ctx.isDelegationTreasurer && !!ctx.selectedDelegation)
}
