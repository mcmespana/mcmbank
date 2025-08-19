"use client"

import { useEffect, useRef } from "react"

interface CallTracker {
  [hookName: string]: number
}

// Global call tracker
const globalCallTracker: CallTracker = {}

export function useDebugCalls(hookName: string, dependencies?: any[]) {
  const renderCountRef = useRef(0)
  const lastDepsRef = useRef<any[]>([])

  // Increment render count
  renderCountRef.current++
  
  // Track global calls
  if (!globalCallTracker[hookName]) {
    globalCallTracker[hookName] = 0
  }
  globalCallTracker[hookName]++

  useEffect(() => {
    console.log(`🔄 ${hookName} - Render #${renderCountRef.current}`)
    
    if (dependencies) {
      const depsChanged = dependencies.some((dep, index) => dep !== lastDepsRef.current[index])
      if (depsChanged) {
        console.log(`📦 ${hookName} - Dependencies changed:`, {
          old: lastDepsRef.current,
          new: dependencies
        })
        lastDepsRef.current = [...dependencies]
      }
    }

    // Warning for excessive calls
    if (globalCallTracker[hookName] > 100) {
      console.error(`🚨 ${hookName} - EXCESO DE LLAMADAS: ${globalCallTracker[hookName]} veces!`)
    } else if (globalCallTracker[hookName] > 50) {
      console.warn(`⚠️ ${hookName} - Muchas llamadas: ${globalCallTracker[hookName]} veces`)
    }
  })

  // Log excessive renders in development
  if (process.env.NODE_ENV === 'development' && renderCountRef.current > 20) {
    console.error(`🚨 ${hookName} - POSIBLE LOOP INFINITO: ${renderCountRef.current} renders`)
  }

  return {
    renderCount: renderCountRef.current,
    totalCalls: globalCallTracker[hookName]
  }
}

// Utility to get call stats
export function getCallStats() {
  return { ...globalCallTracker }
}

// Clear stats (useful for testing)
export function clearCallStats() {
  Object.keys(globalCallTracker).forEach(key => {
    delete globalCallTracker[key]
  })
}
