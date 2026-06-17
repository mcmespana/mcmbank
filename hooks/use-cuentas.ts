"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { CuentaConDelegacion } from "@/lib/types/database"
import { runQuery } from "@/lib/db/query"

interface UseCuentasOptions {
  timeout?: number // milliseconds, default 10000 (10s)
  ttlMs?: number // cache TTL before auto refetch, default 30000 (30s)
  includeInactive?: boolean // incluir cuentas desactivadas (solo gestor de cuentas), default false
}

const SELECT = `
  id,
  delegacion_id,
  nombre,
  tipo,
  origen,
  banco_nombre,
  iban,
  color,
  personas_autorizadas,
  descripcion,
  creado_en,
  banco_conexion_id,
  external_account_uid,
  sync_enabled,
  last_sync_at,
  last_sync_status,
  last_sync_error,
  sync_desde_fecha,
  activa,
  delegacion:delegacion_id (
    id,
    organizacion_id,
    codigo,
    nombre,
    creado_en
  )
`

function cuentasKey(delegacionId: string | null) {
  return ["cuentas", delegacionId] as const
}

// Referencia estable para el caso "sin datos": evita que `query.data ?? []`
// devuelva un array nuevo en cada render (lo que dispararía efectos en bucle).
const EMPTY: CuentaConDelegacion[] = []

async function fetchCuentas(
  delegacionId: string,
  timeout: number
): Promise<CuentaConDelegacion[]> {
  const { data, error } = await runQuery<unknown[]>({
    label: "fetch-cuentas",
    table: "cuenta",
    timeoutMs: timeout,
    build: async (signal) =>
      await supabase
        .from("cuenta")
        .select(SELECT)
        .eq("delegacion_id", delegacionId)
        .abortSignal(signal),
  })

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    delegacion: Array.isArray(item.delegacion) ? item.delegacion[0] : item.delegacion,
  })) as CuentaConDelegacion[]
}

/**
 * Cuentas de una delegación. Migrado a TanStack Query: caché compartida entre
 * páginas, deduplicación de peticiones y revalidación al foco gestionadas por la
 * librería (sin abort controllers ni refs anti-carrera manuales).
 *
 * La caché guarda SIEMPRE todas las cuentas (activas e inactivas) bajo la misma
 * key por delegación; el filtro `includeInactive` se aplica en `select`, de modo
 * que el gestor de cuentas y el resto de la app comparten la misma entrada.
 *
 * Mantiene el contrato anterior (cuentas, loading, error, refetch, forceRefresh,
 * addCuenta, updateCuenta, removeCuenta, cancel) para no tocar a los consumidores.
 */
export function useCuentas(delegacionId: string | null, options: UseCuentasOptions = {}) {
  const { timeout = 10000, ttlMs = 30000, includeInactive = false } = options
  const queryClient = useQueryClient()

  // `select` con identidad estable para que TanStack Query memoice su resultado
  // y devuelva la MISMA referencia mientras los datos no cambien (si no, cada
  // render produciría un array nuevo y los consumidores entrarían en bucle).
  const select = useCallback(
    (rows: CuentaConDelegacion[]) =>
      includeInactive ? rows : rows.filter((c) => (c as any).activa !== false),
    [includeInactive]
  )

  const query = useQuery<CuentaConDelegacion[], Error, CuentaConDelegacion[]>({
    queryKey: cuentasKey(delegacionId),
    queryFn: () => fetchCuentas(delegacionId as string, timeout),
    enabled: Boolean(delegacionId),
    staleTime: ttlMs,
    select,
  })

  const refetch = useCallback(() => query.refetch(), [query])

  // Mutaciones optimistas sobre la caché completa de la delegación.
  const setCache = useCallback(
    (updater: (prev: CuentaConDelegacion[]) => CuentaConDelegacion[]) => {
      queryClient.setQueryData<CuentaConDelegacion[]>(cuentasKey(delegacionId), (prev) =>
        updater(prev ?? [])
      )
    },
    [queryClient, delegacionId]
  )

  return {
    cuentas: query.data ?? EMPTY,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? query.error.message : null,
    refetch,
    forceRefresh: refetch,
    addCuenta: (cuenta: CuentaConDelegacion) => setCache((prev) => [cuenta, ...prev]),
    updateCuenta: (cuentaId: string, updates: Partial<CuentaConDelegacion>) =>
      setCache((prev) => prev.map((c) => (c.id === cuentaId ? { ...c, ...updates } : c))),
    removeCuenta: (cuentaId: string) =>
      setCache((prev) => prev.filter((c) => c.id !== cuentaId)),
    cancel: () => queryClient.cancelQueries({ queryKey: cuentasKey(delegacionId) }),
  }
}
