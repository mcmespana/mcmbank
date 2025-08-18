"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

interface DelegationContextType {
  selectedDelegation: string | null
  setSelectedDelegation: (delegationId: string) => void
  delegations: Delegacion[]
  loading: boolean
  error: string | null
  getCurrentDelegation: () => Delegacion | null
  refetchDelegations: () => Promise<void>
}

const DelegationContext = createContext<DelegationContextType | undefined>(undefined)

export function DelegationProvider({ children }: { children: React.ReactNode }) {
  const [selectedDelegation, setSelectedDelegation] = useState<string | null>(null)
  const [delegations, setDelegations] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchDelegations = async () => {
    if (!user) {
      setDelegations([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("membresia")
        .select(`
          delegacion_id,
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        `)
        .eq("usuario_id", user.id)

      if (error) throw error

      const userDelegations = (data?.map((item) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
      setDelegations(userDelegations)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading delegations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelegations()
  }, [user])

  // Auto-select first delegation when loaded
  useEffect(() => {
    if (!selectedDelegation && delegations.length > 0) {
      setSelectedDelegation(delegations[0].id)
    }
  }, [delegations, selectedDelegation])

  const getCurrentDelegation = () => {
    if (!selectedDelegation) return null
    return delegations.find((d) => d.id === selectedDelegation) || null
  }

  return (
    <DelegationContext.Provider
      value={{
        selectedDelegation,
        setSelectedDelegation,
        delegations,
        loading,
        error,
        getCurrentDelegation,
        refetchDelegations: fetchDelegations,
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
