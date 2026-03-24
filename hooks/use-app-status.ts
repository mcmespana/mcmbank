"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
// Prevents spurious revalidations from quick alt-tabs.
const MIN_HIDDEN_MS = 2000

let revalidationCycleId = 0

// Simple event emitter for cross-hook communication.
// All listeners fire synchronously on emit() so React 18 can batch their state updates
// into a single render pass. This replaces the previous jitter + scheduling system
// which spread state updates across multiple setTimeout ticks, preventing batching
// and causing 14+ separate re-renders on tab refocus.
const appStatusEmitter = {
  listeners: new Set<() => void>(),
  subscribe(callback: () => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  },
  emit() {
    const cycleId = ++revalidationCycleId
    const count = this.listeners.size
    console.log(`[MCM:Reval] 🔄 Cycle #${cycleId} — notifying ${count} listeners synchronously`)
    const start = performance.now()
    for (const listener of this.listeners) {
      listener()
    }
    const elapsed = (performance.now() - start).toFixed(1)
    console.log(`[MCM:Reval] ✅ Cycle #${cycleId} — all ${count} listeners dispatched in ${elapsed}ms (React will batch)`)
  },
}

export const useAppStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  const [isFocused, setIsFocused] = useState(true)
  const hiddenAtRef = useRef<number>(0)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log("[MCM:Net] 🟢 Browser online")
    }
    const handleOffline = () => {
      setIsOnline(false)
      console.log("[MCM:Net] 🔴 Browser offline")
    }

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
    const handleVisibilityChange = () => {
      const isNowFocused = !document.hidden
      setIsFocused(isNowFocused)

      if (!isNowFocused) {
        hiddenAtRef.current = Date.now()
        console.log(`[MCM:Focus] 👁️‍🗨️ Tab hidden`)
        return
      }

      // Tab is now focused — check if it was hidden long enough to warrant revalidation
      const hiddenDuration = Date.now() - hiddenAtRef.current
      if (hiddenAtRef.current > 0 && hiddenDuration < MIN_HIDDEN_MS) {
        console.log(`[MCM:Focus] ⏭️ Tab visible after ${hiddenDuration}ms — skipping revalidation (< ${MIN_HIDDEN_MS}ms)`)
        return
      }

      console.log(`[MCM:Focus] 👁️ Tab visible after ${hiddenDuration}ms — triggering revalidation`)

      // Refresh session in background (don't block revalidation)
      const t0 = performance.now()
      supabase.auth.refreshSession()
        .then(() => console.log(`[MCM:Auth] ✅ Session refreshed in ${(performance.now() - t0).toFixed(0)}ms`))
        .catch(e => console.error(`[MCM:Auth] ❌ Session refresh failed after ${(performance.now() - t0).toFixed(0)}ms:`, e))

      // Fire ALL listeners synchronously — React 18 batches all resulting state updates
      // into a single render. Previously, jitter + scheduling spread updates across
      // multiple event loop ticks, preventing batching and causing render avalanches.
      appStatusEmitter.emit()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return { isOnline, isFocused }
}

// Revalidate on tab focus — callback fires synchronously on emit (for React 18 batching).
// Uses a ref so the subscription is stable (no re-subscribe on every render).
export const useRevalidateOnFocus = (revalidate: () => void) => {
  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate

  useEffect(() => {
    const handler = () => revalidateRef.current()
    const unsubscribe = appStatusEmitter.subscribe(handler)
    return () => { unsubscribe() }
  }, [])
}

// Backward-compatible alias — jitter and scheduling have been removed.
// All listeners now fire synchronously so React 18 can batch state updates
// into a single render instead of 14+ separate re-renders.
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  _opts?: { minMs?: number; maxMs?: number }
) => {
  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate

  useEffect(() => {
    const handler = () => revalidateRef.current()
    const unsubscribe = appStatusEmitter.subscribe(handler)
    return () => { unsubscribe() }
  }, [])
}
