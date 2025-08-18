"use client"

import { useDelegationContext } from "@/contexts/delegation-context"

/**
 * @deprecated This hook is deprecated. Please use `useDelegationContext` instead.
 * This hook is maintained for compatibility with existing components, but will be removed in a future version.
 * It provides access to the shared delegation data.
 */
export function useDelegations() {
  const { delegations, loading, error, refetchDelegations } = useDelegationContext()
  return { delegations, loading, error, refetch: refetchDelegations }
}
