"use client"

import { useState, useEffect, useCallback } from "react"
import { dataAdapter } from "@/lib/data"
import type { Movimiento } from "@/lib/types"
import type { ListMovementsParams } from "@/lib/data-adapter"

export function useMovements(params: ListMovementsParams) {
  const [movements, setMovements] = useState<Movimiento[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    if (!params.delegation_id) return

    try {
      setLoading(true)
      setError(null)
      const data = await dataAdapter.listMovements(params)
      setMovements(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading movements")
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const updateMovement = useCallback(async (movementId: string, patch: Partial<Movimiento>) => {
    try {
      const updatedMovement = await dataAdapter.updateMovement(movementId, patch)
      setMovements((prev) => prev.map((mov) => (mov.id === movementId ? updatedMovement : mov)))
      return updatedMovement
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Error updating movement")
    }
  }, [])

  return {
    movements,
    total,
    loading,
    error,
    refetch: fetchMovements,
    updateMovement,
  }
}
