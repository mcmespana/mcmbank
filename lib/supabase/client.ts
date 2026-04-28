import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

// ─────────────────────────────────────────────────────────────────────────────
// Block Supabase's visibilitychange listener (PERMANENT, page-lifetime patch)
// ─────────────────────────────────────────────────────────────────────────────
// @supabase/auth-js attaches its own document.visibilitychange listener that
// fires _recoverAndRefresh() on tab focus. That internal flow wedges
// _getAccessToken(), so any subsequent .from(...).select(...) queues forever
// waiting for the never-resolving auth promise and never reaches window.fetch.
//
// Supabase registers the listener lazily (on first auth API call), so a
// temporary block during createBrowserClient() doesn't catch it. We install a
// permanent monkey-patch on document/window addEventListener that drops every
// visibilitychange / pageshow / focus registration unless our internal flag
// is flipped — then expose addOurVisibilityListener() so useAppStatus can
// still register its own.
//
// See docs/TAB_SWITCH_HANG_FIX.md for full diagnosis and reasoning.
let _allowOurVisibilityRegistration = false

function installVisibilityBlock() {
  if (typeof document === "undefined" || typeof window === "undefined") return

  const origDocAdd = document.addEventListener.bind(document)
  const origWinAdd = window.addEventListener.bind(window)

  ;(document as any).addEventListener = function (type: string, listener: any, options?: any) {
    if (type === "visibilitychange" && !_allowOurVisibilityRegistration) return
    return origDocAdd(type, listener, options)
  }
  ;(window as any).addEventListener = function (type: string, listener: any, options?: any) {
    if (
      (type === "visibilitychange" || type === "pageshow" || type === "focus") &&
      !_allowOurVisibilityRegistration
    ) {
      return
    }
    return origWinAdd(type, listener, options)
  }
}

installVisibilityBlock()

// Helper used by our own useAppStatus to register its listener — flips the
// allow flag, registers, flips back. Anything Supabase tries to register from
// elsewhere (without flipping the flag) gets dropped.
export function addOurVisibilityListener(
  type: "visibilitychange" | "pageshow" | "focus",
  listener: EventListener,
  target: "document" | "window" = "document",
): () => void {
  _allowOurVisibilityRegistration = true
  try {
    if (target === "window") {
      window.addEventListener(type, listener)
    } else {
      document.addEventListener(type, listener)
    }
  } finally {
    _allowOurVisibilityRegistration = false
  }
  return () => {
    _allowOurVisibilityRegistration = true
    try {
      if (target === "window") {
        window.removeEventListener(type, listener)
      } else {
        document.removeEventListener(type, listener)
      }
    } finally {
      _allowOurVisibilityRegistration = false
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  )
}

// Identity lock — disables navigator.locks-based cross-tab coordination.
// In single-tab usage (the realistic case here) the lock adds nothing and
// has been observed to deadlock; running fn() directly keeps things simple.
async function noLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  return await fn()
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noLock,
    // Avoids parallel refreshSession() calls firing on tab resume from
    // throttled timers piling up. We refresh on demand via runQuery's
    // auth-error retry path.
    autoRefreshToken: false,
  },
})

export function createClient() {
  return supabase
}
