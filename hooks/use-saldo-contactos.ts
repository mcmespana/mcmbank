"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import type { SaldoContactoRow } from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 15000

export interface UseSaldoContactosOptions {
  desde?: string
  hasta?: string
  /** Categorías (actividades) a las que limitar el cálculo. Vacío = todas. */
  categorias?: string[]
}

/**
 * Saldo por contacto de una delegación en un periodo, con filtro de actividad.
 *
 * Se pide a Postgres ya agregado en vez de traer los movimientos y sumarlos
 * aquí: con unos miles da igual, pero la pantalla tiene que seguir abriéndose
 * igual de rápido dentro de unos años.
 */
export function useSaldoContactos(delegacionId?: string | null, options: UseSaldoContactosOptions = {}) {
  const [saldos, setSaldos] = useState<SaldoContactoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { desde, hasta } = options
  // Se serializa para que el efecto no se relance con un array nuevo pero igual.
  const categoriasClave = (options.categorias ?? []).slice().sort().join(",")

  const fetchSaldos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
    }

    if (!delegacionId) {
      setSaldos([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)
    setLoading(true)

    try {
      const data = await Promise.race([
        DatabaseService.getSaldoPorContacto(delegacionId, {
          desde,
          hasta,
          categorias: categoriasClave ? categoriasClave.split(",") : undefined,
          signal: ac.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`saldo por contacto: sin respuesta en ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return
      setSaldos(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "No se pudo calcular el saldo por proveedor")
    } finally {
      unregisterAC(ac)
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, desde, hasta, categoriasClave])

  useEffect(() => {
    void fetchSaldos()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
    }
  }, [fetchSaldos])

  const totales = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    let movimientos = 0
    for (const fila of saldos) {
      ingresos += Number(fila.ingresos)
      gastos += Number(fila.gastos)
      movimientos += Number(fila.movimientos)
    }
    return { ingresos, gastos, neto: ingresos - gastos, movimientos, contactos: saldos.length }
  }, [saldos])

  /** El mayor gasto del periodo: la referencia con la que se dibujan las barras. */
  const gastoMaximo = useMemo(
    () => saldos.reduce((max, fila) => Math.max(max, Number(fila.gastos)), 0),
    [saldos],
  )

  return { saldos, totales, gastoMaximo, loading, error, refetch: fetchSaldos }
}
