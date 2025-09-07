"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { useDelegations } from "@/hooks/use-delegations"
import type { Delegacion } from "@/lib/types/database"

interface DelegationContextType {
  selectedDelegation: string | null
  setSelectedDelegation: (delegationId: string | null) => void
  delegations: Delegacion[]
  loading: boolean
  error: string | null
  getCurrentDelegation: () => Delegacion | null
}

const DelegationContext = createContext<DelegationContextType | undefined>(undefined)

export function DelegationProvider({ children }: { children: React.ReactNode }) {
  const [selectedDelegation, setSelectedDelegationState] = useState<string | null>(null)
  const { delegations, loading, error } = useDelegations()

  const setSelectedDelegation = useCallback((delegationId: string | null) => {
    if (delegationId === selectedDelegation) return
    console.log(`🏢 DelegationContext: Changing delegation from ${selectedDelegation} to ${delegationId}`)
    if (delegationId) {
      const newDelegation = delegations.find(d => d.id === delegationId)
      console.log(`🏢 DelegationContext: New delegation details:`, newDelegation)
    }
    setSelectedDelegationState(delegationId)
  }, [delegations, selectedDelegation])

  // Auto-select first delegation when loaded
  useEffect(() => {
    // Auto-selecciona la primera delegación si no hay ninguna seleccionada todavía
    if (!selectedDelegation && delegations.length > 0) {
      setSelectedDelegation(delegations[0].id)
    }
  }, [delegations, selectedDelegation, setSelectedDelegation])

  const getCurrentDelegation = () => {
    if (!selectedDelegation) return null
    return delegations.find((d) => d.id === selectedDelegation) || null
  }

  const value = useMemo<DelegationContextType>(() => ({
    selectedDelegation,
    setSelectedDelegation,
    delegations,
    loading,
    error,
    getCurrentDelegation,
  }), [selectedDelegation, setSelectedDelegation, delegations, loading, error])

  return (
    <DelegationContext.Provider value={value}>
      {children}
    </DelegationContext.Provider>
  )
}

export function useDelegationContext() {
  const context = useContext(DelegationContext)
  if (context === undefined) {
    throw new Error("useDelegationContext must be used within a DelegationProvider")
  }
  return context
}
