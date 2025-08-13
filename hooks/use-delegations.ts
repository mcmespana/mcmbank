"use client"

import { useState, useEffect } from "react"
import { dataAdapter } from "@/lib/data"
import type { Delegacion } from "@/lib/types"

export function useDelegations() {
  const [delegations, setDelegations] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDelegations = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dataAdapter.listDelegations()
      setDelegations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading delegations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelegations()
  }, [])

  return { delegations, loading, error, refetch: fetchDelegations }
}
