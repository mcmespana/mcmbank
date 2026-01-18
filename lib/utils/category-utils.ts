import type { Categoria } from "@/lib/types/database"

export function buildExpandedCategoryIds(categoryIds: string[], categorias: Categoria[]): string[] {
  const expandedIds = new Set(categoryIds)
  const parentIds = new Set(categoryIds)

  categorias.forEach((categoria) => {
    if (categoria.categoria_padre_id && parentIds.has(categoria.categoria_padre_id)) {
      expandedIds.add(categoria.id)
    }
  })

  return Array.from(expandedIds)
}
