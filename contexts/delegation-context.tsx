"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useDelegations } from "@/hooks/use-delegations"
import type { Delegacion } from "@/lib/types"

interface DelegationContextType {
  selectedDelegation: string | null
  setSelectedDelegation: (delegationId: string) => void
  delegations: Delegacion[]
  loading: boolean
  error: string | null
}

const DelegationContext = createContext<DelegationContextType | undefined>(undefined)

export function DelegationProvider({ children }: { children: React.ReactNode }) {
  const [selectedDelegation, setSelectedDelegation] = useState<string | null>(null)
  const { delegations, loading, error } = useDelegations()

  // Auto-select first delegation when loaded
  useEffect(() => {
    if (!selectedDelegation && delegations.length > 0) {
      setSelectedDelegation(delegations[0].id)
    }
  }, [delegations, selectedDelegation])

  return (
    <DelegationContext.Provider
      value={{
        selectedDelegation,
        setSelectedDelegation,
        delegations,
        loading,
        error,
      }}
    >
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
