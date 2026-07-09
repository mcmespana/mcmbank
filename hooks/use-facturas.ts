"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import type {
  Factura,
  FacturaConRelaciones,
  FacturaEstado,
  FacturaInsert,
  FacturaUpdate,
} from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 12000

export interface UseFacturasOptions {
  estados?: FacturaEstado[]
  contactoId?: string
  busqueda?: string
}

export function useFacturas(delegacionId?: string | null, options: UseFacturasOptions = {}) {
  const [facturas, setFacturas] = useState<FacturaConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const facturasRef = useRef(facturas)
  facturasRef.current = facturas

  const estados = options.estados
  const contactoId = options.contactoId
  const busqueda = options.busqueda?.trim() || undefined
  const estadosKey = useMemo(() => (estados ? [...estados].sort().join(",") : ""), [estados])

  const fetchFacturas = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
    }

    if (!delegacionId) {
      setFacturas([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)

    try {
      if (facturasRef.current.length === 0) {
        setLoading(true)
      }

      const data = await Promise.race([
        DatabaseService.getFacturasByDelegacion(delegacionId, {
          estados,
          contactoId,
          busqueda,
          signal: ac.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`facturas timeout after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return
      setFacturas(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      unregisterAC(ac)
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, estadosKey, contactoId, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRef = useRef(fetchFacturas)
  fetchRef.current = fetchFacturas

  useEffect(() => {
    fetchRef.current()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
    }
  }, [delegacionId, estadosKey, contactoId, busqueda])

  useRevalidateOnFocusJitter(() => fetchRef.current(), { minMs: 80, maxMs: 200 })

  const createFactura = useCallback(
    async (payload: Omit<FacturaInsert, "creado_en" | "actualizado_en">) => {
      const created = await DatabaseService.createFactura(payload)
      await fetchRef.current()
      return created
    },
    [],
  )

  const updateFactura = useCallback(async (id: string, updates: FacturaUpdate) => {
    await DatabaseService.updateFactura(id, updates)
    await fetchRef.current()
  }, [])

  const deleteFactura = useCallback(async (id: string) => {
    await DatabaseService.deleteFactura(id)
    setFacturas((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const linkToMovimiento = useCallback(async (facturaId: string, movimientoId: string, creadoPor?: string) => {
    await DatabaseService.linkFacturaToMovimiento(facturaId, movimientoId, creadoPor)
    await fetchRef.current()
  }, [])

  const unlinkFromMovimiento = useCallback(async (facturaId: string) => {
    await DatabaseService.unlinkFacturaFromMovimiento(facturaId)
    await fetchRef.current()
  }, [])

  const totals = useMemo(() => {
    const base = {
      bandeja: 0,
      sin_pagar: 0,
      pagada: 0,
      pagada_fuera: 0,
      total: 0,
      sinPagarImporte: 0,
    }
    for (const f of facturas) {
      base[f.estado] += 1
      base.total += 1
      if (f.estado === "sin_pagar" && f.importe != null) base.sinPagarImporte += Number(f.importe)
    }
    return base
  }, [facturas])

  return {
    facturas,
    loading,
    error,
    totals,
    refetch: fetchFacturas,
    createFactura,
    updateFactura,
    deleteFactura,
    linkToMovimiento,
    unlinkFromMovimiento,
  }
}

export type UseFacturasReturn = ReturnType<typeof useFacturas>
export type { Factura, FacturaConRelaciones }
