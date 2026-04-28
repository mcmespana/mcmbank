"use client"

import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { abortAllInFlight } from "@/lib/db/in-flight"
import { addOurVisibilityListener } from "@/lib/supabase/client"

// --- Focus version store ---
// Module-level counter bumped on each tab-focus revalidation.
// useSyncExternalStore wires it into React so useEffect([..., focusVersion])
// deps fire *after* React renders with the latest state — no timing races.
let _focusVersion = 0
const _focusListeners = new Set<() => void>()

function _bumpFocusVersion() {
  _focusVersion++
  console.log(`[focus] bumpFocusVersion → v${_focusVersion} (${_focusListeners.size} subscribers)`)
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
  console.log("[forceConnectionReset] starting")
  const { abortAllInFlight } = await import("@/lib/db/in-flight")

  // Just abort + bump. Calling refreshSession() here was hanging when the
  // network was in a zombie state post tab-suspend, defeating the recovery.
  // Hooks will retry their fetches on the focus bump; if auth is genuinely
  // stale the queries will 401 and runQuery's auth retry will handle refresh.
  abortAllInFlight()
  await new Promise<void>((r) => setTimeout(r, 50))
  _bumpFocusVersion()
  console.log("[forceConnectionReset] done — focus version bumped")
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
      console.log(`[visibility] change → focused=${isNowFocused}, hidden_for=${hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0}ms`)
      setIsFocused(isNowFocused)

      if (!isNowFocused) {
        hiddenAtRef.current = Date.now()
        return
      }

      abortAllInFlight()
      await new Promise<void>((r) => setTimeout(r, 50))
      if (!document.hidden) _bumpFocusVersion()
    }

    const handlePageShow = (e: Event) => {
      if ((e as PageTransitionEvent).persisted) handleVisibilityChange()
    }
    const handleOnline = () => {
      if (!document.hidden) handleVisibilityChange()
    }

    // Register through addOurVisibilityListener so the global block in
    // lib/supabase/client.ts (which suppresses Supabase's internal listeners)
    // lets our own listeners through.
    const unsubVis = addOurVisibilityListener("visibilitychange", handleVisibilityChange, "document")
    const unsubShow = addOurVisibilityListener("pageshow", handlePageShow, "window")
    window.addEventListener("online", handleOnline)

    return () => {
      unsubVis()
      unsubShow()
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
