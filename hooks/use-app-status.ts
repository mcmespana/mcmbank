"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
// Prevents spurious revalidations from quick alt-tabs.
const MIN_HIDDEN_MS = 2000

// Global flag to prevent multiple concurrent session refreshes across the entire app.
// This is the single source of truth for "is a refresh in progress?"
let sessionRefreshPromise: Promise<boolean> | null = null

/**
 * Centralized session refresh. Returns true if session is valid after refresh.
 * Deduplicates concurrent calls — only one refresh runs at a time.
 */
export async function ensureSession(): Promise<boolean> {
  if (sessionRefreshPromise) return sessionRefreshPromise

  sessionRefreshPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const { error } = await supabase.auth.refreshSession()
      if (error) {
        console.warn("Session refresh error:", error.message)
        return false
      }
      return true
    } catch (e) {
      console.error("Session refresh failed:", e)
      return false
    } finally {
      sessionRefreshPromise = null
    }
  })()

  return sessionRefreshPromise
}

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
  const hiddenAtRef = useRef<number>(0)
  const revalidatingRef = useRef(false)

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
    const handleVisibilityChange = async () => {
      const isNowFocused = !document.hidden
      setIsFocused(isNowFocused)

      if (!isNowFocused) {
        // Record when the tab was hidden
        hiddenAtRef.current = Date.now()
        return
      }

      // Tab is now focused — check if it was hidden long enough to warrant revalidation
      const hiddenDuration = Date.now() - hiddenAtRef.current
      if (hiddenAtRef.current > 0 && hiddenDuration < MIN_HIDDEN_MS) {
        return
      }

      // Prevent overlapping revalidation cycles
      if (revalidatingRef.current) return
      revalidatingRef.current = true

      try {
        // AWAIT session refresh BEFORE notifying hooks.
        // This is the single centralized refresh — hooks should NOT refresh on their own.
        const ok = await ensureSession()
        if (!ok) {
          console.warn("Session invalid after refresh, skipping data revalidation.")
          return
        }

        // Session is fresh — now notify all hooks to refetch their data
        appStatusEmitter.emit()
      } finally {
        revalidatingRef.current = false
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

// Hooks subscribe to revalidation with a small jitter to spread the load.
// No global batching timer — the session refresh above already serializes the trigger.
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  { minMs = 40, maxMs = 160 }: { minMs?: number; maxMs?: number } = {}
) => {
  // Stabilize revalidate reference to avoid re-subscribing on every render
  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate

  const stableHandler = useCallback(() => {
    const jitter = Math.floor(minMs + Math.random() * (maxMs - minMs))
    const id = setTimeout(() => revalidateRef.current(), jitter)
    return () => clearTimeout(id)
  }, [minMs, maxMs])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const handler = () => {
      if (cleanup) cleanup()
      cleanup = stableHandler()
    }

    const unsubscribe = appStatusEmitter.subscribe(handler)

    return () => {
      unsubscribe()
      if (cleanup) cleanup()
    }
  }, [stableHandler])
}
