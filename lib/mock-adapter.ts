import type { DataAdapter, ListMovementsParams } from "./data-adapter"
import type { Delegacion, Cuenta, Categoria, Movimiento } from "./types"
import { mockDelegaciones, mockCuentas, mockCategorias, mockMovimientos } from "./mock-db"

export class MockAdapter implements DataAdapter {
  private delegaciones = [...mockDelegaciones]
  private cuentas = [...mockCuentas]
  private categorias = [...mockCategorias]
  private movimientos = [...mockMovimientos]

  async listDelegations(): Promise<Delegacion[]> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 100))
    return this.delegaciones
  }

  async listAccounts(delegation_id: string): Promise<Cuenta[]> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return this.cuentas.filter((cuenta) => cuenta.delegacion_id === delegation_id)
  }

  async listCategories(org_id: string): Promise<Categoria[]> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return this.categorias.filter((categoria) => categoria.organizacion_id === org_id)
  }

  async listMovements(params: ListMovementsParams): Promise<{ items: Movimiento[]; total: number }> {
    await new Promise((resolve) => setTimeout(resolve, 150))

    let filtered = this.movimientos.filter((mov) => {
      const cuenta = this.cuentas.find((c) => c.id === mov.cuenta_id)
      return cuenta?.delegacion_id === params.delegation_id
    })

    // Apply filters
    if (params.date_from) {
      filtered = filtered.filter((mov) => mov.fecha >= params.date_from!)
    }
    if (params.date_to) {
      filtered = filtered.filter((mov) => mov.fecha <= params.date_to!)
    }
    if (params.category_id) {
      filtered = filtered.filter((mov) => mov.categoria_id === params.category_id)
    }
    if (params.amount_min !== undefined) {
      filtered = filtered.filter((mov) => mov.importe >= params.amount_min!)
    }
    if (params.amount_max !== undefined) {
      filtered = filtered.filter((mov) => mov.importe <= params.amount_max!)
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Pagination
    const page = params.page || 1
    const pageSize = params.page_size || 50
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return { items, total: filtered.length }
  }

  async updateMovement(movement_id: string, patch: Partial<Movimiento>): Promise<Movimiento> {
    await new Promise((resolve) => setTimeout(resolve, 100))

    const index = this.movimientos.findIndex((mov) => mov.id === movement_id)
    if (index === -1) {
      throw new Error("Movement not found")
    }

    this.movimientos[index] = { ...this.movimientos[index], ...patch }
    return this.movimientos[index]
  }
}
