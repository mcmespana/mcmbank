"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
// Prevents spurious revalidations from quick alt-tabs.
const MIN_HIDDEN_MS = 2000

// Simple event emitter for cross-hook communication.
// Data hooks subscribe to get notified when the tab regains focus.
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
  const revalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      if (!isNowFocused) {
        // Record when the tab was hidden
        hiddenAtRef.current = Date.now()
        // Cancel any pending revalidation if tab is hidden again
        if (revalidationTimerRef.current) {
          clearTimeout(revalidationTimerRef.current)
          revalidationTimerRef.current = null
        }
        return
      }

      // Tab is now focused — check if it was hidden long enough to warrant revalidation
      const hiddenDuration = Date.now() - hiddenAtRef.current
      if (hiddenAtRef.current > 0 && hiddenDuration < MIN_HIDDEN_MS) {
        return
      }

      // Cancel any previous pending revalidation
      if (revalidationTimerRef.current) {
        clearTimeout(revalidationTimerRef.current)
        revalidationTimerRef.current = null
      }

      // STRATEGY: Wait for the Supabase auth client to finish its internal
      // token refresh before notifying data hooks.
      //
      // WHY: The Supabase JS client (v2) uses the Navigator LockManager API
      // for ALL auth operations. When the tab regains focus, the client's own
      // visibilitychange handler acquires an exclusive lock and refreshes the
      // token if expired (network call, 1-5s). Every data query goes through
      // fetchWithAuth() → getAccessToken() → getSession() which ALSO acquires
      // this lock. If our hooks fire while the refresh is in progress, each
      // query blocks on the lock for up to 10s, causing cascading timeouts.
      //
      // The fix: call getSession() ourselves to wait for the lock to be
      // released. Once getSession() returns, the token is fresh and the lock
      // is free. Then we emit to the hooks, whose queries can proceed without
      // blocking. If getSession() takes too long (>8s), we emit anyway and
      // let the hooks handle it — their queries will block briefly but the
      // timeouts are generous enough.
      const emitWithFallback = () => {
        // Race: getSession() vs 8s timeout
        let emitted = false
        const doEmit = () => {
          if (emitted) return
          emitted = true
          appStatusEmitter.emit()
        }

        // Fallback: if getSession() is still blocked after 8s, emit anyway
        const fallbackTimer = setTimeout(doEmit, 8000)

        supabase.auth.getSession()
          .then(() => {
            clearTimeout(fallbackTimer)
            doEmit()
          })
          .catch(() => {
            clearTimeout(fallbackTimer)
            doEmit()
          })
      }

      // Small delay (300ms) to let the Supabase client's visibilitychange
      // handler fire first and start its token refresh. Our getSession() call
      // will then queue behind it.
      revalidationTimerRef.current = setTimeout(emitWithFallback, 300)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (revalidationTimerRef.current) {
        clearTimeout(revalidationTimerRef.current)
      }
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
