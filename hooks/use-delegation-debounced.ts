"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useDelegaciones } from "./use-delegaciones"

interface UseDelegationDebouncedOptions {
  debounceMs?: number
  timeout?: number
}

export function useDelegationDebounced(options: UseDelegationDebouncedOptions = {}) {
  const { debounceMs = 300, timeout = 10000 } = options
  const [selectedDelegation, setSelectedDelegation] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastDelegationRef = useRef<string | null>(null)
  
  const { delegaciones, loading, error } = useDelegaciones({ timeout })
  
  // Debounced delegation change
  const changeDelegation = useCallback((delegationId: string | null) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Skip if same delegation
    if (delegationId === lastDelegationRef.current) {
      console.log('🔄 useDelegationDebounced: Skipping - same delegation')
      return
    }
    
    // Debounce the change
    debounceRef.current = setTimeout(() => {
      console.log('🔄 useDelegationDebounced: Changing delegation to:', delegationId)
      lastDelegationRef.current = delegationId
      setSelectedDelegation(delegationId)
    }, debounceMs)
  }, [debounceMs])
  
  // Auto-select first delegation when loaded
  useEffect(() => {
    if (!selectedDelegation && delegaciones.length > 0 && !loading) {
      const firstDelegation = delegaciones[0].id
      console.log('🔄 useDelegationDebounced: Auto-selecting first delegation:', firstDelegation)
      setSelectedDelegation(firstDelegation)
      lastDelegationRef.current = firstDelegation
    }
  }, [delegaciones, selectedDelegation, loading])
  
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
    delegaciones,
    loading,
    error
  }
}
