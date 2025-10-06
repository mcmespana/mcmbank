"use client"

import { useState, useEffect } from "react"

// This is a simple event emitter for cross-hook communication.
// It allows data hooks to subscribe to focus events without creating complex dependencies.
const appStatusEmitter = {
  listeners: new Set<() => void>(),
  subscribe(callback: () => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  },
  emit() {
    for (const listener of this.listeners) {
      listener()
    }
  },
}

export const useAppStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  const [isFocused, setIsFocused] = useState(true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    
    // Set initial state
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine)
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowFocused = !document.hidden
      setIsFocused(isNowFocused)
      if (isNowFocused) {
        console.log("✨ App is focused, notifying listeners to revalidate data.")
        appStatusEmitter.emit()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return { isOnline, isFocused }
}

// Custom hook for data-fetching components to revalidate on focus.
export const useRevalidateOnFocus = (revalidate: () => void) => {
  useEffect(() => {
    const unsubscribe = appStatusEmitter.subscribe(revalidate)
    return () => { unsubscribe() }
  }, [revalidate])
}

// Global debouncing for revalidations to avoid thundering herd
const REVALIDATION_WINDOW = 500 // ms
const pendingRevalidations = new Set<() => void>()
let revalidationTimer: NodeJS.Timeout | null = null

function scheduleRevalidation(callback: () => void) {
  pendingRevalidations.add(callback)

  if (revalidationTimer) {
    clearTimeout(revalidationTimer)
  }

  revalidationTimer = setTimeout(() => {
    const callbacks = Array.from(pendingRevalidations)
    pendingRevalidations.clear()

    // Execute with staggered timing to reduce load spike
    callbacks.forEach((cb, index) => {
      setTimeout(cb, index * 50)
    })

    revalidationTimer = null
  }, REVALIDATION_WINDOW)
}

// Same as above but adds a small jitter to avoid thundering herd on focus
// Now also includes global debouncing to batch revalidations
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  { minMs = 40, maxMs = 160 }: { minMs?: number; maxMs?: number } = {}
) => {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const handler = () => {
      // Clear any existing timeout before creating a new one
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      const jitter = Math.floor(minMs + Math.random() * (maxMs - minMs))
      timeoutId = setTimeout(() => {
        // Use global debouncing scheduler
        scheduleRevalidation(revalidate)
        timeoutId = null
      }, jitter)
    }

    const unsubscribe = appStatusEmitter.subscribe(handler)

    return () => {
      unsubscribe()
      // Clean up timeout on unmount
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      // Remove from pending revalidations
      pendingRevalidations.delete(revalidate)
    }
  }, [revalidate, minMs, maxMs])
}
