"use client"

import { useEffect, useRef } from "react"
import { useAppStatus } from "@/hooks/use-app-status"
import { supabase } from "@/lib/supabase/client"

// Lightweight background monitor to keep auth/session healthy and nudge the client on focus.
export function ConnectionMonitor() {
  const { isFocused, isOnline } = useAppStatus()
  const runningRef = useRef(false)

  useEffect(() => {
    // On regaining focus and being online, proactively refresh session and do a tiny warm-up query
    const run = async () => {
      if (!isFocused || !isOnline || runningRef.current) return
      runningRef.current = true
      try {
        // Ensure session is valid; explicitly refresh on focus to avoid paused timers
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.auth.refreshSession()
        } else {
          // Touch getUser() to force a roundtrip if we have no session cached
          await supabase.auth.getUser()
        }
        // Warm-up: minimal queries with short timeout to kick PostgREST/RLS
        const ac1 = new AbortController()
        const t1 = setTimeout(() => ac1.abort(), 3000)
        await supabase.from("movimiento").select("id").limit(1).abortSignal(ac1.signal)
        clearTimeout(t1)

        const ac2 = new AbortController()
        const t2 = setTimeout(() => ac2.abort(), 3000)
        await supabase.from("membresia").select("usuario_id").limit(1).abortSignal(ac2.signal)
        clearTimeout(t2)
      } catch {
        // Silent: UI hooks will surface errors as needed
      } finally {
        runningRef.current = false
      }
    }
    run()
  }, [isFocused, isOnline])

  return null
}
