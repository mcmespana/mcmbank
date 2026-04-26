"use client"

import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
const MIN_HIDDEN_MS = 2000

// --- Focus version store ---
// Module-level integer bumped on each successful tab-focus revalidation cycle.
// useSyncExternalStore wires it into React so every useEffect([..., focusVersion])
// dep fires *after* React re-renders with the latest auth/user state.
// This avoids the race in the old emitter approach where callbacks fired
// synchronously before React had flushed the setUser() from onAuthStateChange.
let _focusVersion = 0
const _focusListeners = new Set<() => void>()

function _bumpFocusVersion() {
  _focusVersion++
  _focusListeners.forEach((l) => l())
}

export function useFocusVersion(): number {
  return useSyncExternalStore(
    (callback) => {
      _focusListeners.add(callback)
      return () => _focusListeners.delete(callback)
    },
    () => _focusVersion,
    () => _focusVersion,
  )
}

// Guard: prevent overlapping revalidation cycles (e.g. Chrome firing
// queued visibilitychange events when unfreezing a tab).
let revalidationInFlight = false

export const useAppStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  const [isFocused, setIsFocused] = useState(true)
  const hiddenAtRef = useRef<number>(0)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

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
        hiddenAtRef.current = Date.now()
        return
      }

      // Skip if hidden too briefly
      const hiddenDuration = Date.now() - hiddenAtRef.current
      if (hiddenAtRef.current > 0 && hiddenDuration < MIN_HIDDEN_MS) {
        return
      }

      // Prevent overlapping cycles
      if (revalidationInFlight) return
      revalidationInFlight = true

      try {
        // Refresh the auth token before signalling hooks to revalidate.
        // The 6 s timeout is a safety net; lockWithFallback in client.ts already
        // breaks navigator.locks deadlocks within 5 s.
        try {
          await Promise.race([
            supabase.auth.refreshSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("refresh-timeout")), 6000),
            ),
          ])
        } catch {
          // If refresh fails or times out, hooks handle auth errors individually.
        }

        // Bail if tab was hidden again while we were refreshing
        if (document.hidden) return

        // Give React 150 ms to flush the setUser() call that onAuthStateChange
        // queued inside refreshSession(). Without this, hooks would still read
        // stale user=null when their useEffect([focusVersion]) fired.
        await new Promise<void>((resolve) => setTimeout(resolve, 150))

        if (document.hidden) return

        // Bump the version — useSyncExternalStore notifies all subscribers,
        // React queues re-renders, then useEffect([..., focusVersion]) fires
        // after the render with fully-updated auth state.
        _bumpFocusVersion()
      } finally {
        // Always release the guard — even if _bumpFocusVersion throws.
        revalidationInFlight = false
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return { isOnline, isFocused }
}

// Revalidate on tab focus. Uses useFocusVersion so the callback fires inside
// a useEffect — after React renders with the latest state — instead of being
// called synchronously from the visibilitychange handler.
export const useRevalidateOnFocus = (revalidate: () => void) => {
  const focusVersion = useFocusVersion()
  const ref = useRef(revalidate)
  ref.current = revalidate
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      // Skip the initial mount; only fire on subsequent version bumps.
      mounted.current = true
      return
    }
    ref.current()
  }, [focusVersion])
}

// Backward-compatible alias (jitter/scheduling was already a no-op).
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  _opts?: { minMs?: number; maxMs?: number },
) => {
  useRevalidateOnFocus(revalidate)
}
