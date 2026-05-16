"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import type {
  PagoMcm,
  PagoMcmConRelaciones,
  PagoMcmEstado,
  PagoMcmInsert,
  PagoMcmUpdate,
} from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 12000

export interface UsePagosMcmOptions {
  estados?: PagoMcmEstado[]
  contactoId?: string
  busqueda?: string
}

export function usePagosMcm(delegacionId?: string | null, options: UsePagosMcmOptions = {}) {
  const [pagos, setPagos] = useState<PagoMcmConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pagosRef = useRef(pagos)
  pagosRef.current = pagos

  const estados = options.estados
  const contactoId = options.contactoId
  const busqueda = options.busqueda?.trim() || undefined
  const estadosKey = useMemo(() => (estados ? [...estados].sort().join(",") : ""), [estados])

  const fetchPagos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
    }

    if (!delegacionId) {
      setPagos([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)

    try {
      if (pagosRef.current.length === 0) {
        setLoading(true)
      }

      const data = await Promise.race([
        DatabaseService.getPagosMcmByDelegacion(delegacionId, {
          estados,
          contactoId,
          busqueda,
          signal: ac.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`pagos_mcm timeout after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return
      setPagos(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      unregisterAC(ac)
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, estadosKey, contactoId, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRef = useRef(fetchPagos)
  fetchRef.current = fetchPagos

  useEffect(() => {
    fetchRef.current()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegacionId, estadosKey, contactoId, busqueda])

  useRevalidateOnFocusJitter(() => fetchRef.current(), { minMs: 80, maxMs: 200 })

  const createPago = useCallback(
    async (payload: Omit<PagoMcmInsert, "creado_en" | "actualizado_en">) => {
      const created = await DatabaseService.createPagoMcm(payload)
      await fetchRef.current()
      return created
    },
    [],
  )

  const updatePago = useCallback(async (id: string, updates: PagoMcmUpdate) => {
    await DatabaseService.updatePagoMcm(id, updates)
    await fetchRef.current()
  }, [])

  const deletePago = useCallback(async (id: string) => {
    await DatabaseService.deletePagoMcm(id)
    setPagos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const convertToMovimiento = useCallback(
    async (
      pagoId: string,
      options: { cuentaId: string; fecha: string; delegacionId: string; creadoPor: string },
    ) => {
      const result = await DatabaseService.convertPagoToMovimiento(pagoId, options)
      await fetchRef.current()
      return result
    },
    [],
  )

  const linkToMovimiento = useCallback(async (pagoId: string, movimientoId: string) => {
    await DatabaseService.linkPagoToMovimiento(pagoId, movimientoId)
    await fetchRef.current()
  }, [])

  const unlinkFromMovimiento = useCallback(async (pagoId: string) => {
    await DatabaseService.unlinkPagoFromMovimiento(pagoId)
    await fetchRef.current()
  }, [])

  const totals = useMemo(() => {
    const base = {
      borrador: 0,
      pendiente: 0,
      pagado: 0,
      cancelado: 0,
      total: 0,
      pendienteImporte: 0,
      pagadoImporte: 0,
    }
    for (const p of pagos) {
      base[p.estado] += 1
      base.total += 1
      if (p.estado === "pendiente") base.pendienteImporte += Number(p.importe)
      if (p.estado === "pagado") base.pagadoImporte += Number(p.importe)
    }
    return base
  }, [pagos])

  return {
    pagos,
    loading,
    error,
    totals,
    refetch: fetchPagos,
    createPago,
    updatePago,
    deletePago,
    convertToMovimiento,
    linkToMovimiento,
    unlinkFromMovimiento,
  }
}

export type UsePagosMcmReturn = ReturnType<typeof usePagosMcm>
export type { PagoMcm, PagoMcmConRelaciones }
