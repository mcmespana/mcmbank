"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
// Prevents spurious revalidations from quick alt-tabs.
const MIN_HIDDEN_MS = 2000

// Global flag to prevent multiple concurrent session checks across the entire app.
let sessionCheckPromise: Promise<boolean> | null = null

/**
 * Lightweight session check. Returns true if a valid session exists.
 *
 * IMPORTANT: We intentionally do NOT call refreshSession() here.
 * The Supabase client auto-refreshes tokens internally via onAuthStateChange.
 * Manually calling refreshSession() on tab focus:
 *  1. Makes a blocking /token network request (50-300ms) that stalls while
 *     the browser is still reestablishing HTTP connections after tab switch.
 *  2. Fires TOKEN_REFRESHED which can trigger cascading re-renders.
 *  3. Puts the client's internal auth state in a transitional state, causing
 *     concurrent PostgREST queries to fail or hang.
 *
 * If the token IS expired, the Supabase client will auto-refresh it on the
 * next API call. If that fails with 401, runQuery's retry logic handles it.
 */
export async function ensureSession(): Promise<boolean> {
  if (sessionCheckPromise) return sessionCheckPromise

  sessionCheckPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return !!session
    } catch (e) {
      console.error("Session check failed:", e)
      return false
    } finally {
      sessionCheckPromise = null
    }
  })()

  return sessionCheckPromise
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
        // Quick session existence check (no network call — reads from memory).
        // If the session exists, we trust it. The Supabase client will auto-refresh
        // expired tokens on the next API call. If it doesn't exist, skip revalidation.
        const ok = await ensureSession()
        if (!ok) {
          console.warn("No session found, skipping data revalidation.")
          return
        }

        // Session exists — notify all hooks to refetch their data
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
