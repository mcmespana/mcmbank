"use client"

import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { abortAllInFlight } from "@/lib/db/in-flight"
import { addOurVisibilityListener } from "@/lib/supabase/client"

// ─────────────────────────────────────────────────────────────────────────────
// Focus-version store
// ─────────────────────────────────────────────────────────────────────────────
// Module-level counter bumped on each tab-focus revalidation. useSyncExternalStore
// wires it into React so useEffect([..., focusVersion]) deps fire after React
// renders with the latest state (no timing races against auth state updates).

let _focusVersion = 0
const _focusListeners = new Set<() => void>()

// Intervalo mínimo entre revalidaciones por foco. Alternar pestañas más rápido
// que esto reutiliza los datos ya cargados en vez de relanzar todas las queries.
const MIN_REVALIDATE_INTERVAL_MS = 10_000
let _lastFocusRevalidate = 0

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

// ─────────────────────────────────────────────────────────────────────────────
// useAppStatus — registers visibility / online listeners
// ─────────────────────────────────────────────────────────────────────────────
// On tab focus we abort any zombie fetches Chrome left mid-flight and bump
// the focus version, which causes every hook subscribed via useRevalidateOnFocus
// to re-run its query. We register the visibility listener via
// addOurVisibilityListener so the global block in lib/supabase/client.ts (which
// suppresses Supabase's internal recovery listener — see TAB_SWITCH_HANG_FIX.md)
// lets ours through.

export const useAppStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  const [isFocused, setIsFocused] = useState(true)

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
      if (!isNowFocused) return

      // Evita ráfagas de refetch al alternar pestañas rápidamente: si la última
      // revalidación por foco fue hace menos de MIN_REVALIDATE_INTERVAL_MS, los
      // datos siguen frescos y no merece la pena recargar toda la app de nuevo.
      const now = Date.now()
      if (now - _lastFocusRevalidate < MIN_REVALIDATE_INTERVAL_MS) return
      _lastFocusRevalidate = now

      abortAllInFlight()
      // tiny delay so abort propagates before bump triggers re-render
      await new Promise<void>((r) => setTimeout(r, 50))
      if (!document.hidden) _bumpFocusVersion()
    }

    const unsub = addOurVisibilityListener("visibilitychange", handleVisibilityChange, "document")
    return unsub
  }, [])

  return { isOnline, isFocused }
}

// ─────────────────────────────────────────────────────────────────────────────
// useRevalidateOnFocus — subscribe to focus-version bumps
// ─────────────────────────────────────────────────────────────────────────────
// Calls revalidate() inside a useEffect (after React render with latest state),
// not synchronously from the event handler — avoids timing races where the
// callback would read stale closures.

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

// Backward-compatible alias (jitter behaviour was already a no-op).
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  _opts?: { minMs?: number; maxMs?: number },
) => {
  useRevalidateOnFocus(revalidate)
}
