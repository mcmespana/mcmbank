"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"

// Minimum time (ms) the tab must be hidden before we trigger revalidation on refocus.
const MIN_HIDDEN_MS = 2000

// Simple event emitter for cross-hook revalidation.
// All listeners fire synchronously inside emit() so React 18 can batch
// their state updates into a single render pass.
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

      // Prevent overlapping cycles (Chrome can queue multiple visibilitychange events)
      if (revalidationInFlight) return
      revalidationInFlight = true

      try {
        // CRITICAL: refresh the auth token BEFORE any hooks fire queries.
        // Without this, 7 hooks hit Supabase with a stale token simultaneously,
        // each triggers its own refreshSession() retry via runQuery, and
        // navigator.locks contention + render cascade freezes the UI.
        await supabase.auth.refreshSession()
      } catch {
        // If refresh fails, hooks will handle auth errors individually
      }

      // Bail if tab was hidden again while we were refreshing
      if (document.hidden) {
        revalidationInFlight = false
        return
      }

      // Fire ALL listeners synchronously — React 18 batches all resulting
      // setState calls into a single render pass.
      appStatusEmitter.emit()
      revalidationInFlight = false
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return { isOnline, isFocused }
}

// Revalidate on tab focus. Uses a ref so the subscription is stable
// (no re-subscribe on every render when the callback identity changes).
export const useRevalidateOnFocus = (revalidate: () => void) => {
  const ref = useRef(revalidate)
  ref.current = revalidate

  useEffect(() => {
    const handler = () => ref.current()
    const unsubscribe = appStatusEmitter.subscribe(handler)
    return () => { unsubscribe() }
  }, [])
}

// Backward-compatible alias — jitter/scheduling removed.
// All listeners now fire synchronously so React 18 can batch state updates.
export const useRevalidateOnFocusJitter = (
  revalidate: () => void,
  _opts?: { minMs?: number; maxMs?: number }
) => {
  const ref = useRef(revalidate)
  ref.current = revalidate

  useEffect(() => {
    const handler = () => ref.current()
    const unsubscribe = appStatusEmitter.subscribe(handler)
    return () => { unsubscribe() }
  }, [])
}
