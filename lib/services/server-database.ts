import { createClient } from "@/lib/supabase/server"
import type {
  Delegacion,
  Categoria,
  Membresia,
  MovimientoConRelaciones,
  CuentaConDelegacion,
} from "@/lib/types/database"

export class ServerDatabaseService {
  private static getServerClient() {
    return createClient()
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
    return (data?.map((item) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
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

    let query = supabase
      .from("movimiento")
      .select(`
        *,
        cuenta:cuenta_id (
          *,
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        ),
        categoria:categoria_id (
          id,
          organizacion_id,
          nombre,
          tipo,
          emoji,
          orden,
          categoria_padre_id,
          creado_en
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
  static async getCategoriasByOrganizacion(organizacionId: string): Promise<Categoria[]> {
    const supabase = this.getServerClient()
    const { data, error } = await supabase
      .from("categoria")
      .select("*")
      .eq("organizacion_id", organizacionId)
      .order("orden", { ascending: true })

    if (error) throw error
    return data || []
  }
}
