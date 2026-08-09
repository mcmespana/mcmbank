import type { FacturaConRelaciones, MovimientoConRelaciones } from "@/lib/types/database"

/**
 * Lógica pura de conciliación factura ↔ movimiento.
 *
 * Vive separada de `lib/utils/facturas.ts` (que arrastra iconos y clases de
 * Tailwind para la interfaz) para que el servidor —la API externa y el servidor
 * MCP— pueda puntuar candidatos sin importar nada de React.
 */

/** Suma de los movimientos ya vinculados a una factura (valor absoluto). */
export function importePagadoFactura(factura: Pick<FacturaConRelaciones, "movimientos">): number {
  return (factura.movimientos ?? []).reduce((sum, m) => sum + Math.abs(Number(m.importe)), 0)
}

/**
 * Importe que le falta a la factura por cubrir (null si no tiene importe
 * definido). Nunca negativo.
 */
export function importePendienteFactura(
  factura: Pick<FacturaConRelaciones, "movimientos" | "importe">,
): number | null {
  if (factura.importe == null) return null
  return Math.max(Number(factura.importe) - importePagadoFactura(factura), 0)
}

/**
 * Margen de importe para buscar movimientos candidatos de una factura:
 * un 2% del importe con un mínimo de 0,50 € ("un pelín de margen").
 */
export function margenImporteFactura(importe: number): number {
  return Math.max(Math.abs(importe) * 0.02, 0.5)
}

export interface CandidatoScore {
  score: number
  importeExacto: boolean
  fechaCercana: boolean
  mismoContacto: boolean
}

/**
 * Puntúa un movimiento como candidato para una factura. El precio manda:
 * importe exacto pesa mucho más que la fecha; el contacto ayuda a desempatar.
 */
export function scoreCandidatoMovimiento(
  factura: { importe?: number | null; fecha_emision?: string | null; contacto_id?: string | null },
  movimiento: Pick<MovimientoConRelaciones, "importe" | "fecha" | "contacto_id">,
): CandidatoScore {
  let score = 0

  const importeExacto =
    factura.importe != null && Math.abs(Math.abs(Number(movimiento.importe)) - Math.abs(Number(factura.importe))) < 0.005
  if (importeExacto) score += 4
  else if (factura.importe != null) score += 1 // dentro del margen (la query ya filtró)

  let fechaCercana = false
  if (factura.fecha_emision && movimiento.fecha) {
    const diffDias = Math.abs(
      (new Date(movimiento.fecha).getTime() - new Date(factura.fecha_emision).getTime()) / 86400000,
    )
    if (diffDias <= 5) {
      score += 2
      fechaCercana = true
    } else if (diffDias <= 20) {
      score += 1
    }
  }

  const mismoContacto = Boolean(factura.contacto_id && movimiento.contacto_id === factura.contacto_id)
  if (mismoContacto) score += 2

  return { score, importeExacto, fechaCercana, mismoContacto }
}

/**
 * Un candidato es "match directo" si tiene importe exacto y destaca claramente
 * sobre el segundo (o es el único).
 */
export function esMatchDirecto(scores: CandidatoScore[]): boolean {
  if (scores.length === 0) return false
  const [primero, segundo] = scores
  if (!primero.importeExacto) return false
  if (!segundo) return true
  return primero.score >= segundo.score + 2
}
