"use client"

import { useState, useEffect } from "react"
import { useDelegationContext } from "@/contexts/delegation-context"

interface SidebarCounts {
  transactionCount: number
  categoryCount: number
  loading: boolean
}

export function useSidebarCounts(): SidebarCounts {
  const [transactionCount, setTransactionCount] = useState(0)
  const [categoryCount, setCategoryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  useEffect(() => {
    // For now, return mock counts
    // In a real implementation, you would fetch these from the database
    const fetchCounts = async () => {
      setLoading(true)
      try {
        // Mock data - replace with actual API calls
        setTransactionCount(47)
        setCategoryCount(12)
      } catch (error) {
        console.error("Error fetching sidebar counts:", error)
        setTransactionCount(0)
        setCategoryCount(0)
      } finally {
        setLoading(false)
      }
    }

    if (selectedDelegation && organizacionId) {
      fetchCounts()
    } else {
      setTransactionCount(0)
      setCategoryCount(0)
      setLoading(false)
    }
  }, [selectedDelegation, organizacionId])

  return {
    transactionCount,
    categoryCount,
    loading
  }
}