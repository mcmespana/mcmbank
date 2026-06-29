import { createClient } from "@/lib/supabase/server"
import type {
  Delegacion,
  Categoria,
  CategoriaConOrdenEfectivo,
  CategoriaOrdenDelegacion,
  Membresia,
  MovimientoConRelaciones,
  CuentaConDelegacion,
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
    // Visibilidad de ALCANCE GLOBAL: sin overrides de visibilidad por delegación.
    const esta_activa_override = null
    const esta_activa_efectiva = categoria.esta_activa

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

export class ServerDatabaseService {
  private static getServerClient() {
    return createClient() as any
  }

  // User and membership operations (server-side)
  static async getUserMemberships(userId: string): Promise<Membresia[]> {
    const supabase = this.getServerClient()
    const { data, error } = await supabase.from("membresia").select("*").eq("usuario_id", userId)

    if (error) throw error
    return data || []
  }

  static async getUserDelegaciones(userId: string): Promise<Delegacion[]> {
    const supabase = this.getServerClient()
    const { data, error } = await supabase
      .from("membresia")
      .select(`
        delegacion_id,
        delegacion:delegacion_id (
          id,
          organizacion_id,
          codigo,
          nombre,
          creado_en
        )
      `)
      .eq("usuario_id", userId)

    if (error) throw error
    return ((data as any)?.map((item: any) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
  }

  // Delegacion operations (server-side)
  static async getDelegacionById(id: string): Promise<Delegacion | null> {
    const supabase = this.getServerClient()
    const { data, error } = await supabase.from("delegacion").select("*").eq("id", id).single()

    if (error) return null
    return data
  }

  // Cuenta operations (server-side)
  static async getCuentasByDelegacion(delegacionId: string): Promise<CuentaConDelegacion[]> {
    const supabase = this.getServerClient()
    const { data, error } = await supabase
      .from("cuenta")
      .select(`
        *,
        delegacion:delegacion_id (
          id,
          organizacion_id,
          codigo,
          nombre,
          creado_en
        )
      `)
      .eq("delegacion_id", delegacionId)

    if (error) throw error
    return data || []
  }

  // Movimiento operations (server-side)
  static async getMovimientosByDelegacion(
    delegacionId: string,
    filters?: {
      fechaDesde?: string
      fechaHasta?: string
      categoriaId?: string
      cuentaId?: string
      busqueda?: string
    },
  ): Promise<MovimientoConRelaciones[]> {
    const supabase = this.getServerClient()

    // Optimized: use delegacion_id directly instead of JOIN through cuenta
    let query = supabase
      .from("movimiento")
      .select(`
        *,
        cuenta:cuenta_id (*),
        categoria:categoria_id (
          id,
          organizacion_id,
          delegacion_id,
          nombre,
          tipo,
          emoji,
          color,
          orden,
          categoria_padre_id,
          creado_en,
          es_global
        )
      `)
      .eq("delegacion_id", delegacionId)
      .order("fecha", { ascending: false })

    if (filters?.fechaDesde) {
      query = query.gte("fecha", filters.fechaDesde)
    }
    if (filters?.fechaHasta) {
      query = query.lte("fecha", filters.fechaHasta)
    }
    if (filters?.categoriaId) {
      query = query.eq("categoria_id", filters.categoriaId)
    }
    if (filters?.cuentaId) {
      query = query.eq("cuenta_id", filters.cuentaId)
    }
    if (filters?.busqueda) {
      query = query.or(`concepto.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  // Categoria operations (server-side)
  static async getCategoriasByDelegacion(
    delegacionId?: string | null,
    options: { includeGlobal?: boolean; includeInactive?: boolean } = {},
  ): Promise<CategoriaConOrdenEfectivo[]> {
    const supabase = this.getServerClient()
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

    const { data, error } = await query

    if (error) throw error
    const mapped = mapCategorias(data as CategoriaWithOverrides[] | null, delegacionId)
    if (includeInactive) {
      return mapped
    }
    return mapped.filter((categoria) => categoria.esta_activa_efectiva !== false)
  }

  static async setDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
    orden: number,
  ): Promise<void> {
    const supabase = this.getServerClient()
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

  static async clearDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
  ): Promise<void> {
    const supabase = this.getServerClient()
    const { error } = await supabase
      .from("categoria_orden_delegacion")
      .delete()
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })

    if (error) throw error
  }
}
