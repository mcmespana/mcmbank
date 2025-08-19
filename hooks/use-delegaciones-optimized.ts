"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

interface UseDelegacionesOptions {
  timeout?: number // milliseconds, default 10000 (10s)
}

export function useDelegacionesOptimized({ timeout = 10000 }: UseDelegacionesOptions = {}) {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchDelegaciones = useCallback(async () => {
    if (!user) {
      setDelegaciones([])
      setLoading(false)
      return
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      setLoading(true)
      setError(null)

      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          abortController.abort()
          reject(new Error(`Consulta de delegaciones cancelada por timeout (${timeout}ms)`))
        }, timeout)
      })

      // OPTIMIZED QUERY: Simplified to reduce JOIN complexity
      const queryPromise = supabase
        .from("membresia")
        .select(`
          delegacion_id,
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        `)
        .eq("usuario_id", user.id)
        .abortSignal(abortController.signal)

      // Race between the query and timeout
      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      // Clear timeout if query completed successfully
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      if (abortController.signal.aborted) {
        return // Request was cancelled
      }

      if (error) {
        throw error
      }

      const delegacionesData = (data?.map((item) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
      setDelegaciones(delegacionesData)
    } catch (err) {
      if (abortController.signal.aborted) {
        console.log("Delegaciones query was cancelled")
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Error fetching delegaciones:", errorMessage)
      setError(errorMessage)
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
      
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, timeout])

  useEffect(() => {
    fetchDelegaciones()
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [fetchDelegaciones])

  return { 
    delegaciones, 
    loading, 
    error, 
    refetch: fetchDelegaciones,
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }
}
