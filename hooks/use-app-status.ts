"use client"

import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { supabase } from "@/lib/supabase/client"
import { abortAllInFlight } from "@/lib/db/in-flight"

// Minimum hidden time (ms) before we bother refreshing the auth token.
// Zombie fetch cleanup (abortAllInFlight) always fires regardless of this.
const MIN_HIDDEN_MS_FOR_AUTH_REFRESH = 2000

// --- Focus version store ---
// Module-level counter bumped on each tab-focus revalidation.
// useSyncExternalStore wires it into React so useEffect([..., focusVersion])
// deps fire *after* React renders with the latest state — no timing races.
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
    if (typeof navigator !== "undefined") setIsOnline(navigator.onLine)
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

      // ── Step 1: Kill zombie fetches immediately ──────────────────────────
      // Chrome can suspend JS mid-fetch; those promises never resolve.
      // Aborting forces hooks into a clean state so they restart on bump.
      abortAllInFlight()

      const hiddenMs = hiddenAtRef.current > 0 ? Date.now() - hiddenAtRef.current : 0
      const needsAuthRefresh = hiddenMs >= MIN_HIDDEN_MS_FOR_AUTH_REFRESH

      if (!needsAuthRefresh) {
        // Short hide: zombie fetches killed. Bump version to restart them.
        // No auth refresh needed — token is still fresh.
        await new Promise<void>((r) => setTimeout(r, 50))
        if (!document.hidden) _bumpFocusVersion()
        return
      }

      // Long hide: refresh auth token before restarting hooks.
      // revalidationInFlight prevents parallel refresh cycles.
      if (revalidationInFlight) return
      revalidationInFlight = true

      try {
        // The 6 s timeout guards against navigator.locks deadlock (lockWithFallback
        // in client.ts also handles this within 5 s, so this is a belt-and-braces).
        try {
          await Promise.race([
            supabase.auth.refreshSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("refresh-timeout")), 6000),
            ),
          ])
        } catch {
          // Refresh failure is non-fatal; individual hooks retry on auth error.
        }

        if (document.hidden) return

        // 150 ms: let React flush setUser() from onAuthStateChange so hooks
        // read the updated auth state when their useEffect([focusVersion]) fires.
        await new Promise<void>((r) => setTimeout(r, 150))

        if (document.hidden) return

        _bumpFocusVersion()
      } finally {
        revalidationInFlight = false
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return { isOnline, isFocused }
}

// Revalidate on tab focus. Uses useFocusVersion so the callback fires inside
// useEffect — after React renders with the latest state — not synchronously
// from the event handler.
export const useRevalidateOnFocus = (revalidate: () => void) => {
  const focusVersion = useFocusVersion()
  const ref = useRef(revalidate)
  ref.current = revalidate
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    ref.current()
  }, [focusVersion])
}

// Backward-compatible alias (jitter was already a no-op).
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  _opts?: { minMs?: number; maxMs?: number },
) => {
  useRevalidateOnFocus(revalidate)
}
