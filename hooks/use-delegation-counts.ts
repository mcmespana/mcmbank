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
  /** Facturas que piden algo: en la bandeja sin revisar, o sin pagar. */
  facturasAtencion: number | null
}

const INITIAL_COUNTS: DelegationCounts = {
  movimientos: null,
  categorias: null,
  cuentas: null,
  contactos: null,
  pagosMcmPendientes: null,
  facturasAtencion: null,
}

async function fetchCounts(
  delegationId: string,
  organizacionId: string | null,
  signal: AbortSignal,
): Promise<DelegationCounts> {
  const [movimientosRes, cuentasRes, categoriasRes, contactosPropiosRes, contactosAdoptadosRes, pagosMcmRes, facturasRes] =
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
      // Los contactos propios de la delegación (personas y destinatarios).
      supabase
        .from("contacto")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("es_global", false)
        .eq("archivado", false)
        .abortSignal(signal),
      // Y los compartidos que ESTA delegación usa. Contar todos los globales,
      // como se hacía antes, daba el mismo número en las 18 delegaciones en
      // cuanto los proveedores pasaron a ser de todo MCM.
      supabase
        .from("contacto_delegacion")
        .select("contacto_id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("archivado", false)
        .abortSignal(signal),
      supabase
        .from("pago_mcm")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .eq("estado", "pendiente")
        .abortSignal(signal),
      // Bandeja (sin revisar) y sin pagar (sin_pagar/pagada_parcial): lo mismo
      // que las pestañas "Bandeja" y "Pendientes" de Facturas, lo que pide
      // acción de alguien. "Pagada"/"pagada_fuera" ya están resueltas.
      supabase
        .from("factura")
        .select("id", { head: true, count: "exact" })
        .eq("delegacion_id", delegationId)
        .in("estado", ["bandeja", "sin_pagar", "pagada_parcial"])
        .abortSignal(signal),
    ])

  const errors = [
    movimientosRes.error,
    cuentasRes.error,
    organizacionId ? categoriasRes.error : null,
    contactosPropiosRes.error,
    contactosAdoptadosRes.error,
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
    contactos:
      contactosPropiosRes.error || contactosAdoptadosRes.error
        ? null
        : (contactosPropiosRes.count ?? 0) + (contactosAdoptadosRes.count ?? 0),
    pagosMcmPendientes: pagosMcmRes.error ? null : (pagosMcmRes.count ?? 0),
    facturasAtencion: facturasRes.error ? null : (facturasRes.count ?? 0),
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
