"use client"

import { useState, useEffect } from "react"
import { dataAdapter } from "@/lib/data"
import type { Cuenta } from "@/lib/types"

export function useAccounts(delegationId: string) {
  const [accounts, setAccounts] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAccounts() {
      if (!delegationId) return

      try {
        setLoading(true)
        setError(null)
        const data = await dataAdapter.listAccounts(delegationId)
        setAccounts(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading accounts")
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [delegationId])

  return { accounts, loading, error }
}
