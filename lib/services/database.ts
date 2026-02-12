import { supabase } from "@/lib/supabase/client"
import type {
  Categoria,
  CategoriaConOrdenEfectivo,
  CategoriaOrdenDelegacion,
} from "@/lib/types/database"

type CategoriaWithOverrides = Categoria & {
  overrides?: CategoriaOrdenDelegacion[] | null
}

const selectCategoriasWithOverrides = `
  *,
  overrides:categoria_orden_delegacion!left (
    delegacion_id,
    categoria_id,
    orden,
    esta_activa
  )
`

function mapCategorias(
  data: CategoriaWithOverrides[] | null,
  delegacionId?: string | null,
): CategoriaConOrdenEfectivo[] {
  if (!data) return []

  const mapped = data.map((item) => {
    const { overrides, orden, ...categoria } = item
    const override = delegacionId
      ? overrides?.find((entry) => entry.delegacion_id === delegacionId)
      : null

    const orden_base = orden
    const overrideOrdenRaw = override?.orden ?? null
    const orden_override =
      override && overrideOrdenRaw !== null && overrideOrdenRaw !== orden_base
        ? overrideOrdenRaw
        : null
    const orden_efectivo = orden_override ?? orden_base
    const esta_activa_override =
      override && typeof override.esta_activa === "boolean"
        ? override.esta_activa
        : null
    const esta_activa_efectiva =
      esta_activa_override !== null ? esta_activa_override : categoria.esta_activa

    return {
      ...categoria,
      orden,
      orden_base,
      orden_override,
      orden_efectivo,
      esta_activa_override,
      esta_activa_efectiva,
      has_override: Boolean(override),
    }
  })

  return mapped.sort((a, b) => {
    if (a.orden_efectivo !== b.orden_efectivo) {
      return a.orden_efectivo - b.orden_efectivo
    }
    return a.nombre.localeCompare(b.nombre)
  })
}

export class DatabaseService {
  private static getClient() {
    return supabase
  }

  // Movimiento operations (client-side only)
  static async updateMovimientoCategoria(movimientoId: string, categoriaId: string | null): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)

    if (error) throw error
  }

  // Categoria operations (client-side only)
  static async getCategoriasByDelegacion(
    delegacionId?: string | null,
    options: { includeGlobal?: boolean; includeInactive?: boolean; signal?: AbortSignal } = {},
  ): Promise<CategoriaConOrdenEfectivo[]> {
    const supabase = this.getClient()
    const includeGlobal = options.includeGlobal ?? true
    const includeInactive = options.includeInactive ?? false

    if (!delegacionId && includeGlobal === false) {
      return []
    }

    let query = supabase
      .from("categoria")
      .select(selectCategoriasWithOverrides)
      .order("orden", { ascending: true })

    if (delegacionId) {
      query = includeGlobal
        ? query.or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
        : query.eq("delegacion_id", delegacionId)
    } else if (includeGlobal) {
      query = query.eq("es_global", true)
    }

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query

    if (error) throw error
    const mapped = mapCategorias(data as CategoriaWithOverrides[] | null, delegacionId)
    if (includeInactive) {
      return mapped
    }
    return mapped.filter((categoria) => categoria.esta_activa_efectiva !== false)
  }

  static async createCategoria(
    categoria: Omit<Categoria, "id" | "creado_en">,
  ): Promise<Categoria> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("categoria").insert(categoria as any).select().single()

    if (error) throw error
    return data
  }

  static async updateCategoria(id: string, updates: Partial<Categoria>): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("categoria").update(updates as any).eq("id", id)

    if (error) throw error
  }

  static async deleteCategoria(id: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("categoria").delete().eq("id", id)

    if (error) throw error
  }

  static async setDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
    orden: number,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("categoria_orden_delegacion")
      .update({ orden, actualizado_en: now } as any)
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })
      .select("categoria_id")

    if (error) throw error

    if (!data || data.length === 0) {
      const { error: insertError } = await supabase.from("categoria_orden_delegacion").insert({
        delegacion_id: delegacionId,
        categoria_id: categoriaId,
        orden,
        esta_activa: true,
      } as any)

      if (insertError) throw insertError
    }
  }

  static async setDelegacionCategoryVisibility(
    delegacionId: string,
    categoriaId: string,
    estaActiva: boolean,
    ordenFallback: number,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("categoria_orden_delegacion")
      .update({ esta_activa: estaActiva, actualizado_en: now } as any)
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })
      .select("categoria_id")

    if (error) throw error

    if (!data || data.length === 0) {
      const { error: insertError } = await supabase.from("categoria_orden_delegacion").insert({
        delegacion_id: delegacionId,
        categoria_id: categoriaId,
        orden: ordenFallback,
        esta_activa: estaActiva,
      } as any)

      if (insertError) throw insertError
    }
  }

  static async clearDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase
      .from("categoria_orden_delegacion")
      .delete()
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })

    if (error) throw error
  }
}
