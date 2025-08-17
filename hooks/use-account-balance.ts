"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export function useAccountBalance(accountId: string | null) {
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!accountId) {
      setBalance(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("movimiento")
        .select("importe")
        .eq("cuenta_id", accountId)
        .eq("ignorado", false)

      if (error) throw error

      const total = data?.reduce((sum, mov) => sum + (mov.importe || 0), 0) || 0
      setBalance(total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error calculating balance")
      setBalance(0)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, loading, error, refetch: fetchBalance }
}