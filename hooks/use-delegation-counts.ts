"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useDelegationContext } from "@/contexts/delegation-context"
import { runQuery } from "@/lib/db/query"
import { useRevalidateOnFocusJitter } from "@/hooks/use-app-status"

export interface DelegationCounts {
  movimientos: number | null
  categorias: number | null
  cuentas: number | null
  contactos: number | null
  pagosMcmPendientes: number | null
}

const INITIAL_COUNTS: DelegationCounts = {
  movimientos: null,
  categorias: null,
  cuentas: null,
  contactos: null,
  pagosMcmPendientes: null,
}

const QUERY_TIMEOUT_MS = 10000

export function useDelegationCounts() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()

  const [counts, setCounts] = useState<DelegationCounts>(INITIAL_COUNTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRef = useRef(0)
  const lastDelegationRef = useRef<string | null>(null)

  const fetchCounts = useCallback(async () => {
    const delegationId = selectedDelegation

    if (!delegationId) {
      lastDelegationRef.current = null
      setCounts(INITIAL_COUNTS)
      setLoading(false)
      setError(null)
      return
    }

    if (lastDelegationRef.current !== delegationId) {
      lastDelegationRef.current = delegationId
      setCounts(INITIAL_COUNTS)
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    const delegation = getCurrentDelegation()
    const organizacionId = delegation?.organizacion_id ?? null

    try {
      const [movimientosRes, cuentasRes, categoriasRes, contactosRes, pagosMcmRes] = await Promise.all([
        runQuery<{ count: number | null }>({
          label: "count-movimientos",
          table: "movimiento",
          timeoutMs: QUERY_TIMEOUT_MS,
          build: async (signal) => {
            const { count, error } = await supabase
              .from("movimiento")
              .select("id", { head: true, count: "exact" })
              .eq("delegacion_id", delegationId)
              .abortSignal(signal)
            return { data: { count: typeof count === "number" ? count : 0 }, error }
          },
        }),
        runQuery<{ count: number | null }>({
          label: "count-cuentas",
          table: "cuenta",
          timeoutMs: QUERY_TIMEOUT_MS,
          build: async (signal) => {
            const { count, error } = await supabase
              .from("cuenta")
              .select("id", { head: true, count: "exact" })
              .eq("delegacion_id", delegationId)
              .abortSignal(signal)
            return { data: { count: typeof count === "number" ? count : 0 }, error }
          },
        }),
        organizacionId
          ? runQuery<{ count: number | null }>({
              label: "count-categorias",
              table: "categoria",
              timeoutMs: QUERY_TIMEOUT_MS,
              build: async (signal) => {
                const { count, error } = await supabase
                  .from("categoria")
                  .select("id", { head: true, count: "exact" })
                  .eq("organizacion_id", organizacionId)
                  .abortSignal(signal)
                return { data: { count: typeof count === "number" ? count : 0 }, error }
              },
            })
          : Promise.resolve({ data: { count: null }, error: null }),
        runQuery<{ count: number | null }>({
          label: "count-contactos",
          table: "contacto",
          timeoutMs: QUERY_TIMEOUT_MS,
          build: async (signal) => {
            const { count, error } = await supabase
              .from("contacto")
              .select("id", { head: true, count: "exact" })
              .or(`delegacion_id.eq.${delegationId},es_global.is.true`)
              .eq("archivado", false)
              .abortSignal(signal)
            return { data: { count: typeof count === "number" ? count : 0 }, error }
          },
        }),
        runQuery<{ count: number | null }>({
          label: "count-pagos-mcm-pendientes",
          table: "pago_mcm",
          timeoutMs: QUERY_TIMEOUT_MS,
          build: async (signal) => {
            const { count, error } = await supabase
              .from("pago_mcm")
              .select("id", { head: true, count: "exact" })
              .eq("delegacion_id", delegationId)
              .eq("estado", "pendiente")
              .abortSignal(signal)
            return { data: { count: typeof count === "number" ? count : 0 }, error }
          },
        }),
      ])

      if (requestRef.current !== fetchId) return

      const nextCounts: DelegationCounts = {
        movimientos: movimientosRes.error ? null : movimientosRes.data?.count ?? 0,
        cuentas: cuentasRes.error ? null : cuentasRes.data?.count ?? 0,
        categorias:
          organizacionId === null
            ? null
            : categoriasRes.error
              ? null
              : categoriasRes.data?.count ?? 0,
        contactos: contactosRes.error ? null : contactosRes.data?.count ?? 0,
        pagosMcmPendientes: pagosMcmRes.error ? null : pagosMcmRes.data?.count ?? 0,
      }

      const hasError =
        Boolean(movimientosRes.error) ||
        Boolean(cuentasRes.error) ||
        (organizacionId !== null && Boolean(categoriasRes.error)) ||
        Boolean(contactosRes.error) ||
        Boolean(pagosMcmRes.error)

      if (hasError) {
        console.warn("⚠️ useDelegationCounts: error loading counts", {
          movimientosError: movimientosRes.error,
          cuentasError: cuentasRes.error,
          categoriasError: categoriasRes.error,
          contactosError: contactosRes.error,
          pagosMcmError: pagosMcmRes.error,
        })
        setError("No se pudieron cargar todos los totales")
      } else {
        setError(null)
      }

      setCounts(nextCounts)
    } catch (err) {
      if (requestRef.current !== fetchId) return
      console.error("❌ useDelegationCounts: unexpected error", err)
      setCounts(INITIAL_COUNTS)
      setError(err instanceof Error ? err.message : "No se pudieron cargar los totales")
    } finally {
      if (requestRef.current === fetchId) {
        setLoading(false)
      }
    }
  }, [selectedDelegation, getCurrentDelegation])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  useRevalidateOnFocusJitter(fetchCounts, { minMs: 80, maxMs: 180 })

  return {
    counts,
    loading,
    error,
    refresh: fetchCounts,
  }
}

export { INITIAL_COUNTS as INITIAL_DELEGATION_COUNTS }
