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
    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    const setFocusState = (isNowFocused: boolean, reason: string) => {
      setIsFocused(isNowFocused)
      if (isNowFocused) {
        console.log(
          `✨ App is focused (${reason}), notifying listeners to revalidate data.`,
        )
        appStatusEmitter.emit()
      }
    }

    const handleVisibilityChange = () => {
      setFocusState(!document.hidden, "visibilitychange")
    }

    const handleFocus = () => {
      setFocusState(true, "window-focus")
    }

    const handleBlur = () => {
      setFocusState(false, "window-blur")
    }

    const handlePageShow = () => {
      setFocusState(true, "pageshow")
    }

    const handlePageHide = () => {
      setFocusState(false, "pagehide")
    }

    // Sync with the current visibility state when the hook mounts
    setFocusState(!document.hidden, "init")

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("pagehide", handlePageHide)
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
