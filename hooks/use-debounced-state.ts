"use client"

import { useState, useEffect } from "react"

/**
 * Hook for debouncing state changes.
 * Useful for search inputs, filters, etc. to avoid triggering queries on every keystroke.
 */
export function useDebouncedState<T>(initialValue: T, delay = 300) {
  const [immediateValue, setImmediateValue] = useState(initialValue)
  const [debouncedValue, setDebouncedValue] = useState(initialValue)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(immediateValue)
    }, delay)

    return () => clearTimeout(timer)
  }, [immediateValue, delay])

  return {
    value: debouncedValue,        // For queries
    immediateValue,                // For UI (shows changes instantly)
    setValue: setImmediateValue,   // For onChange handlers
    isPending: immediateValue !== debouncedValue,
  }
}

/**
 * Specialized hook for category filter debouncing
 */
export function useDebouncedCategoryFilter(initialValue: string[] = [], delay = 300) {
  const { value, immediateValue, setValue, isPending } = useDebouncedState(initialValue, delay)

  return {
    categoryIds: value,              // For queries
    selectedCategories: immediateValue, // For CategorySelector component
    setCategoryIds: setValue,        // For onChange handler
    isPending,
  }
}
