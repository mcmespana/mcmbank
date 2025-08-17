import { supabase } from "@/lib/supabase/client"
import type { Categoria, Cuenta } from "@/lib/types/database"

export class DatabaseService {
  private static getClient() {
    return supabase
  }

  // Movimiento operations (client-side only)
  static async updateMovimientoCategoria(movimientoId: string, categoriaId: string | null): Promise<void> {
    const supabase = this.getClient()
    const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)

    if (error) throw error
  }

  // Categoria operations (client-side only)
  static async getCategoriasByOrganizacion(organizacionId: string): Promise<Categoria[]> {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from("categoria")
      .select("*")
      .eq("organizacion_id", organizacionId)
      .order("orden", { ascending: true })

    if (error) throw error
    return data || []
  }

  static async createCategoria(categoria: Omit<Categoria, "id" | "creado_en">): Promise<Categoria> {
    const supabase = this.getClient()
    const { data, error } = await supabase.from("categoria").insert(categoria).select().single()

    if (error) throw error
    return data
  }

  static async updateCategoria(id: string, updates: Partial<Categoria>): Promise<void> {
    const supabase = this.getClient()
    const { error } = await supabase.from("categoria").update(updates).eq("id", id)

    if (error) throw error
  }

  static async deleteCategoria(id: string): Promise<void> {
    const supabase = this.getClient()
    const { error } = await supabase.from("categoria").delete().eq("id", id)

    if (error) throw error
  }

  // Cuenta operations (client-side only)
  static async createAccount(account: Omit<Cuenta, "id" | "creado_en">): Promise<Cuenta> {
    const supabase = this.getClient()
    const { data, error } = await supabase.from("cuenta").insert(account).select().single()

    if (error) throw error
    return data
  }

  static async updateAccount(id: string, updates: Partial<Cuenta>): Promise<void> {
    const supabase = this.getClient()
    const { error } = await supabase.from("cuenta").update(updates).eq("id", id)

    if (error) throw error
  }

  static async deleteAccount(id: string): Promise<void> {
    const supabase = this.getClient()
    
    // First delete all related transactions
    const { error: movimientosError } = await supabase.from("movimiento").delete().eq("cuenta_id", id)
    if (movimientosError) throw movimientosError
    
    // Then delete the account
    const { error } = await supabase.from("cuenta").delete().eq("id", id)
    if (error) throw error
  }
}
