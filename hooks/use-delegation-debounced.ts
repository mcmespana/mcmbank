"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useDelegations } from "./use-delegations"

interface UseDelegationDebouncedOptions {
  debounceMs?: number
  timeout?: number
}

export function useDelegationDebounced(options: UseDelegationDebouncedOptions = {}) {
  const { debounceMs = 300, timeout = 10000 } = options
  const [selectedDelegation, setSelectedDelegation] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastDelegationRef = useRef<string | null>(null)
  
  const { delegations, loading, error } = useDelegations({ timeout })
  
  // Debounced delegation change
  const changeDelegation = useCallback((delegationId: string | null) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Skip if same delegation
    if (delegationId === lastDelegationRef.current) {
      return
    }
    
    // Debounce the change
    debounceRef.current = setTimeout(() => {
      lastDelegationRef.current = delegationId
      setSelectedDelegation(delegationId)
    }, debounceMs)
  }, [debounceMs])
  
  // Auto-select first delegation when loaded
  useEffect(() => {
    if (!selectedDelegation && delegations.length > 0 && !loading) {
      const firstDelegation = delegations[0].id
      setSelectedDelegation(firstDelegation)
      lastDelegationRef.current = firstDelegation
    }
  }, [delegations, selectedDelegation, loading])
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])
  
  return {
    selectedDelegation,
    changeDelegation,
    delegaciones: delegations,
    loading,
    error
  }
}
