import type { Delegacion, Cuenta, Categoria, Movimiento } from "./types"

export type ListMovementsParams = {
  delegation_id: string
  date_from?: string // 'YYYY-MM-DD'
  date_to?: string // 'YYYY-MM-DD'
  category_id?: string
  amount_min?: number
  amount_max?: number
  page?: number
  page_size?: number
}

export interface DataAdapter {
  listDelegations(): Promise<Delegacion[]>
  listAccounts(delegation_id: string): Promise<Cuenta[]>
  listCategories(org_id: string): Promise<Categoria[]>
  listMovements(params: ListMovementsParams): Promise<{ items: Movimiento[]; total: number }>
  updateMovement(movement_id: string, patch: Partial<Movimiento>): Promise<Movimiento>
}

// Placeholder for future Supabase implementation
export class SupabaseAdapter implements DataAdapter {
  async listDelegations(): Promise<Delegacion[]> {
    throw new Error("SupabaseAdapter not implemented yet")
  }

  async listAccounts(delegation_id: string): Promise<Cuenta[]> {
    throw new Error("SupabaseAdapter not implemented yet")
  }

  async listCategories(org_id: string): Promise<Categoria[]> {
    throw new Error("SupabaseAdapter not implemented yet")
  }

  async listMovements(params: ListMovementsParams): Promise<{ items: Movimiento[]; total: number }> {
    throw new Error("SupabaseAdapter not implemented yet")
  }

  async updateMovement(movement_id: string, patch: Partial<Movimiento>): Promise<Movimiento> {
    throw new Error("SupabaseAdapter not implemented yet")
  }
}
