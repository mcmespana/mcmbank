"use client"

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { useDelegationContext } from "@/contexts/delegation-context"

export interface DelegationCounts {
  movimientos: number | null
  categorias: number | null
  cuentas: number | null
  contactos: number | null
  pagosMcmPendientes: number | null
  facturasBandeja: number | null
}

const INITIAL_COUNTS: DelegationCounts = {
  movimientos: null,
  categorias: null,
  cuentas: null,
  contactos: null,
  pagosMcmPendientes: null,
  facturasBandeja: null,
}

async function fetchCounts(
  delegationId: string,
  organizacionId: string | null,
  signal: AbortSignal,
): Promise<DelegationCounts> {
  const [movimientosRes, cuentasRes, categoriasRes, contactosRes, pagosMcmRes, facturasRes] =
    await Promise.all([
      supabase
        .from("movimiento")
        .select("id, cuenta:cuenta_id!inner(activa)", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("cuenta.activa", true)
        .abortSignal(signal),
      supabase
        .from("cuenta")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .abortSignal(signal),
      organizacionId
        ? supabase
            .from("categoria")
            .select("id", { head: true, count: "exact" })
            .eq("organizacion_id", organizacionId)
            .abortSignal(signal)
        : Promise.resolve({ count: null, error: null }),
      supabase
        .from("contacto")
        .select("id", { head: true, count: "exact" })
        .or(`delegacion_id.eq.${delegationId},es_global.is.true`)
        .eq("archivado", false)
        .abortSignal(signal),
      supabase
        .from("pago_mcm")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("estado", "pendiente")
        .abortSignal(signal),
      supabase
        .from("factura")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("estado", "bandeja")
        .abortSignal(signal),
    ])

  const errors = [
    movimientosRes.error,
    cuentasRes.error,
    organizacionId ? categoriasRes.error : null,
    contactosRes.error,
    pagosMcmRes.error,
    facturasRes.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    console.warn("⚠️ useDelegationCounts: error loading counts", errors)
  }

  return {
    movimientos: movimientosRes.error ? null : (movimientosRes.count ?? 0),
    cuentas: cuentasRes.error ? null : (cuentasRes.count ?? 0),
    categorias: organizacionId === null ? null : categoriasRes.error ? null : (categoriasRes.count ?? 0),
    contactos: contactosRes.error ? null : (contactosRes.count ?? 0),
    pagosMcmPendientes: pagosMcmRes.error ? null : (pagosMcmRes.count ?? 0),
    facturasBandeja: facturasRes.error ? null : (facturasRes.count ?? 0),
  }
}

/**
 * Contadores por delegación (badges del sidebar/topbar). Migrado a TanStack
 * Query: caché compartida y revalidación al foco centralizadas por la
 * librería en vez de un `useRevalidateOnFocusJitter` propio — evita que estos
 * 6 counts se repitan en cada focus de pestaña si los datos siguen frescos
 * (`staleTime` global de 30s en `QueryProvider`).
 *
 * Mantiene el mismo contrato de salida que la versión anterior (counts,
 * loading, error, refresh) para no tocar a los consumidores.
 */
export function useDelegationCounts() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const organizacionId = getCurrentDelegation()?.organizacion_id ?? null

  const query = useQuery<DelegationCounts>({
    queryKey: ["delegation-counts", selectedDelegation, organizacionId],
    queryFn: ({ signal }) => fetchCounts(selectedDelegation as string, organizacionId, signal),
    enabled: Boolean(selectedDelegation),
  })

  return {
    counts: query.data ?? INITIAL_COUNTS,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? "No se pudieron cargar todos los totales" : null,
    refresh: query.refetch,
  }
}

export { INITIAL_COUNTS as INITIAL_DELEGATION_COUNTS }
