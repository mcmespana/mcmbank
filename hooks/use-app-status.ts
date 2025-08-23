"use client"

import { useState, useEffect, useCallback } from "react"

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

// Same as above but adds a small jitter to avoid thundering herd on focus
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  { minMs = 40, maxMs = 160 }: { minMs?: number; maxMs?: number } = {}
) => {
  useEffect(() => {
    const handler = () => {
      const jitter = Math.floor(minMs + Math.random() * (maxMs - minMs))
      const id = setTimeout(() => revalidate(), jitter)
      return () => clearTimeout(id)
    }
    const wrapped = () => { handler() }
    const unsubscribe = appStatusEmitter.subscribe(wrapped)
    return () => { unsubscribe() }
  }, [revalidate, minMs, maxMs])
}
