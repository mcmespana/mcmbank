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
 * Puede ACTIVAR/DESACTIVAR una categoría (cambiar esta_activa).
 * - Las categorías GLOBALES no se activan/desactivan: su visibilidad es global y
 *   están siempre activas. Si una global ya no se quiere, se elimina (el archivado
 *   de actividades será una funcionalidad aparte en el futuro).
 * - Tesorero: solo sus categorías locales.
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
 * (Desactivado) Ocultar/mostrar una categoría global por delegación.
 *
 * El modelo es de ALCANCE GLOBAL: no hay overrides de visibilidad por delegación.
 * Las categorías globales están activas para todas las delegaciones. Se conserva
 * la función (devolviendo siempre false) para no romper los componentes que la
 * referencian, pero ya no expone ningún control en la interfaz.
 */
export function canHideGlobalCategory(
  _ctx: CategoryPermissionContext,
  _category: CategoriaConOrdenEfectivo
): boolean {
  return false
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
