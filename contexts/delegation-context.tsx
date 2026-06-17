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

  // Ref avoids recreating setSelectedDelegation when delegations refetch
  // (which would cascade through the entire context consumer tree).
  // getCurrentDelegation lee el ref en tiempo de llamada, así que actualizarlo
  // en un efecto (no durante el render) es seguro y satisface react-hooks/refs.
  const delegationsRef = useRef(delegations)
  useEffect(() => {
    delegationsRef.current = delegations
  }, [delegations])

  const setSelectedDelegation = useCallback((delegationId: string | null) => {
    if (delegationId === selectedDelegation) return
    if (delegationId) {
      localStorage.setItem('mcmbank-selected-delegation', delegationId)
    } else {
      localStorage.removeItem('mcmbank-selected-delegation')
    }
    setSelectedDelegationState(delegationId)
  }, [selectedDelegation])

  // Auto-select first delegation when loaded (only if no valid selection exists).
  // Inicialización a partir de datos asíncronos (las delegaciones llegan por red);
  // es un efecto legítimo, no estado derivable durante el render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (delegations.length === 0) return
    // If current selection is still valid in the list, keep it
    if (selectedDelegation && delegations.some(d => d.id === selectedDelegation)) return
    // Otherwise pick the first one
    setSelectedDelegation(delegations[0].id)
  }, [delegations, selectedDelegation, setSelectedDelegation])
  /* eslint-enable react-hooks/set-state-in-effect */

  const getCurrentDelegation = useCallback(() => {
    if (!selectedDelegation) return null
    return delegationsRef.current.find((d) => d.id === selectedDelegation) || null
  }, [selectedDelegation])

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
