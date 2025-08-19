"use client"

import { useState, useEffect } from "react"
import { dataAdapter } from "@/lib/data"
import type { Categoria } from "@/lib/types"

export function useCategories(orgId: string) {
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      if (!orgId) return

      try {
        setLoading(true)
        setError(null)
        const data = await dataAdapter.listCategories(orgId)
        // Sort by order
        data.sort((a, b) => a.orden - b.orden)
        setCategories(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading categories")
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [orgId])

  return { categories, loading, error }
}
