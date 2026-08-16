"use client"

import { useCallback, useEffect, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import type { FacturaConRelaciones } from "@/lib/types/database"

/**
 * La factura de la bandeja vinculada a un movimiento, si la hay. Compartido
 * entre la pestaña Archivos y la pestaña Datos del detalle de movimiento: las
 * dos necesitan saber si hay factura vinculada, no solo la de Archivos.
 */
export function useFacturaVinculada(movementId: string | null) {
  const [facturaVinculada, setFacturaVinculada] = useState<FacturaConRelaciones | null>(null)

  const fetchFacturaVinculada = useCallback(async () => {
    if (!movementId) {
      setFacturaVinculada(null)
      return
    }
    try {
      const factura = await DatabaseService.getFacturaByMovimiento(movementId)
      setFacturaVinculada(factura)
    } catch {
      setFacturaVinculada(null)
    }
  }, [movementId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFacturaVinculada()
  }, [fetchFacturaVinculada])

  return { facturaVinculada, fetchFacturaVinculada }
}
