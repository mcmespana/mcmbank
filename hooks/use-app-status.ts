"use client"

import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { abortAllInFlight } from "@/lib/db/in-flight"

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

// Manual recovery trigger — topbar button calls this when the app gets stuck.
// HAR analysis showed that when stuck, hooks bail on !user (React state went
// null) so just bumping focusVersion produces zero network calls. We must
// re-init auth state first via refreshSession(), which fires onAuthStateChange
// → AuthProvider's setUser() → React re-renders → hooks no longer bail.
export async function forceConnectionReset(): Promise<void> {
  console.debug("[forceConnectionReset] starting")
  const { abortAllInFlight } = await import("@/lib/db/in-flight")

  // Just abort + bump. Calling refreshSession() here was hanging when the
  // network was in a zombie state post tab-suspend, defeating the recovery.
  // Hooks will retry their fetches on the focus bump; if auth is genuinely
  // stale the queries will 401 and runQuery's auth retry will handle refresh.
  abortAllInFlight()
  await new Promise<void>((r) => setTimeout(r, 50))
  _bumpFocusVersion()
  console.debug("[forceConnectionReset] done — focus version bumped")
}

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

      // Kill zombie fetches immediately. Chrome suspends JS mid-fetch and
      // those promises never resolve; aborting forces hooks into a clean
      // state so they restart on the version bump.
      abortAllInFlight()

      // Don't call refreshSession() here. Empirically refreshSession() hangs
      // when the network is in a zombie state right after tab resume — the
      // POST /auth/v1/token never completes, leaving every other hook stuck
      // waiting on auth. Trust runQuery's auth-error retry path: if a hook's
      // query gets 401, runQuery refreshes the session inline. By that time
      // the network has unstuck itself.
      await new Promise<void>((r) => setTimeout(r, 50))
      if (!document.hidden) _bumpFocusVersion()
    }

    // pageshow with persisted=true fires when Chrome restores the tab from
    // BFCache (back/forward cache). visibilitychange may not fire reliably
    // in that flow. Triggering the same handler covers both cases.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) handleVisibilityChange()
    }
    // online fires when network connectivity returns after a drop —
    // good moment to abort zombie fetches and restart queries.
    const handleOnline = () => {
      if (!document.hidden) handleVisibilityChange()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("online", handleOnline)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("online", handleOnline)
    }
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
