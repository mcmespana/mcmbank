import type { Movimiento, Cuenta, Categoria } from "@/lib/types"

export interface MovimientoConDatos extends Movimiento {
  cuenta?: Cuenta
  categoria?: Categoria
}

export function enrichMovementsWithData(
  movements: Movimiento[],
  accounts: Cuenta[],
  categories: Categoria[],
): MovimientoConDatos[] {
  return movements.map((movement) => ({
    ...movement,
    cuenta: accounts.find((account) => account.id === movement.cuenta_id),
    categoria: categories.find((category) => category.id === movement.categoria_id),
  }))
}

export function getAccountDisplayName(cuenta: Cuenta): string {
  if (cuenta.tipo === "caja") {
    return cuenta.nombre
  }
  return cuenta.banco_nombre ? `${cuenta.banco_nombre} - ${cuenta.nombre}` : cuenta.nombre
}

export function getAccountIcon(cuenta: Cuenta): string {
  return cuenta.tipo === "banco" ? "🏦" : "💵"
}
