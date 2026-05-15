import { supabase } from "@/lib/supabase/client"
import type {
  Categoria,
  CategoryBreakdownRow,
  CategoriaConOrdenEfectivo,
  CategoriaOrdenDelegacion,
  Contacto,
  ContactoConCategoriaPredeterminada,
  ContactoInsert,
  ContactoTipo,
  ContactoUpdate,
  FinancialSummary,
  MonthlyTrendRow,
  MovimientoConRelaciones,
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

  // ---------------------------------------------------------------------------
  // Contacto operations (client-side)
  // ---------------------------------------------------------------------------

  static async getContactosByDelegacion(
    delegacionId?: string | null,
    options: {
      tipo?: ContactoTipo
      busqueda?: string
      incluirArchivados?: boolean
      incluirGlobales?: boolean
      signal?: AbortSignal
    } = {},
  ): Promise<ContactoConCategoriaPredeterminada[]> {
    const supabase = this.getClient() as any
    const incluirGlobales = options.incluirGlobales ?? true

    if (!delegacionId && !incluirGlobales) return []

    let query = supabase
      .from("contacto")
      .select(`
        *,
        categoria_predeterminada:categoria_id_predeterminada (
          id,
          nombre,
          emoji,
          color
        )
      `)
      .order("archivado", { ascending: true })
      .order("nombre", { ascending: true })

    if (delegacionId) {
      query = incluirGlobales
        ? query.or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
        : query.eq("delegacion_id", delegacionId)
    } else if (incluirGlobales) {
      query = query.eq("es_global", true)
    }

    if (options.tipo) {
      query = query.eq("tipo", options.tipo)
    }

    if (!options.incluirArchivados) {
      query = query.eq("archivado", false)
    }

    if (options.busqueda) {
      const term = options.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
      query = query.or(
        `nombre.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%,identificador_fiscal.ilike.%${term}%,iban.ilike.%${term}%`,
      )
    }

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as ContactoConCategoriaPredeterminada[]
  }

  static async getContactoById(id: string): Promise<ContactoConCategoriaPredeterminada | null> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase
      .from("contacto")
      .select(`
        *,
        categoria_predeterminada:categoria_id_predeterminada (
          id,
          nombre,
          emoji,
          color
        )
      `)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ContactoConCategoriaPredeterminada | null
  }

  static async createContacto(
    contacto: Omit<ContactoInsert, "creado_en" | "actualizado_en">,
  ): Promise<Contacto> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("contacto").insert(contacto).select().single()
    if (error) throw error
    return data as Contacto
  }

  static async updateContacto(id: string, updates: ContactoUpdate): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("contacto").update(updates).eq("id", id)
    if (error) throw error
  }

  static async deleteContacto(id: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("contacto").delete().eq("id", id)
    if (error) throw error
  }

  static async archiveContacto(id: string, archivado: boolean): Promise<void> {
    await this.updateContacto(id, { archivado })
  }

  static async getMovimientosByContacto(
    contactoId: string,
    options: { limite?: number; signal?: AbortSignal } = {},
  ): Promise<MovimientoConRelaciones[]> {
    const supabase = this.getClient() as any
    const limite = options.limite ?? 100

    let query = supabase
      .from("movimiento")
      .select(`
        id,
        delegacion_id,
        cuenta_id,
        fecha,
        concepto,
        descripcion,
        importe,
        notas,
        ignorado,
        categoria_id,
        contacto_id,
        creado_en,
        cuenta:cuenta_id (
          id,
          delegacion_id,
          nombre,
          tipo,
          origen,
          banco_nombre,
          color
        ),
        categoria:categoria_id (
          id,
          nombre,
          color,
          tipo,
          emoji,
          orden,
          categoria_padre_id,
          creado_en
        )
      `)
      .eq("contacto_id", contactoId)
      .eq("ignorado", false)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(limite)

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as MovimientoConRelaciones[]
  }

  // ---------------------------------------------------------------------------
  // Dashboard aggregations (RPC — computed in database, not in JS)
  // ---------------------------------------------------------------------------

  static async getFinancialSummary(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<FinancialSummary> {
    const client = this.getClient() as any
    let query = client.rpc("get_financial_summary", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    // rpc returns an array of rows; we want the first (and only) row
    const row = Array.isArray(data) ? data[0] : data
    return {
      ingresos: Number(row?.ingresos ?? 0),
      gastos: Number(row?.gastos ?? 0),
      balance: Number(row?.balance ?? 0),
      total_movimientos: Number(row?.total_movimientos ?? 0),
      sin_categoria: Number(row?.sin_categoria ?? 0),
    }
  }

  static async getMonthlyTrend(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<MonthlyTrendRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_monthly_trend", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      mes: String(row.mes),
      ingresos: Number(row.ingresos ?? 0),
      gastos: Number(row.gastos ?? 0),
    }))
  }

  static async getCategoryBreakdown(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<CategoryBreakdownRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_category_breakdown", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      categoria_id: row.categoria_id ?? null,
      categoria_nombre: row.categoria_nombre ?? null,
      categoria_emoji: row.categoria_emoji ?? null,
      categoria_color: row.categoria_color ?? null,
      ingresos: Number(row.ingresos ?? 0),
      gastos: Number(row.gastos ?? 0),
    }))
  }
}
