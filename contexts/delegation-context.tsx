"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  const [selectedDelegation, setSelectedDelegationState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcmbank-selected-delegation') || null
    }
    return null
  })
  const { delegations, loading, error } = useDelegations()

  // Keep refs so callbacks don't depend on changing values
  const delegationsRef = useRef(delegations)
  delegationsRef.current = delegations
  const selectedRef = useRef(selectedDelegation)
  selectedRef.current = selectedDelegation

  // Stable callback — no dependencies on delegations or selectedDelegation
  const setSelectedDelegation = useCallback((delegationId: string | null) => {
    if (delegationId === selectedRef.current) return
    if (delegationId) {
      localStorage.setItem('mcmbank-selected-delegation', delegationId)
    } else {
      localStorage.removeItem('mcmbank-selected-delegation')
    }
    setSelectedDelegationState(delegationId)
  }, [])

  // Auto-select first delegation when loaded (only if no valid selection exists)
  useEffect(() => {
    if (delegations.length === 0) return
    // If current selection is still valid in the list, keep it
    if (selectedDelegation && delegations.some(d => d.id === selectedDelegation)) return
    // Otherwise pick the first one
    setSelectedDelegation(delegations[0].id)
  }, [delegations, selectedDelegation, setSelectedDelegation])

  // Stable callback — reads from refs
  const getCurrentDelegation = useCallback(() => {
    const sel = selectedRef.current
    if (!sel) return null
    return delegationsRef.current.find((d) => d.id === sel) || null
  }, [])

  const value = useMemo<DelegationContextType>(() => ({
    selectedDelegation,
    setSelectedDelegation,
    delegations,
    loading,
    error,
    getCurrentDelegation,
  }), [selectedDelegation, setSelectedDelegation, delegations, loading, error, getCurrentDelegation])

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
