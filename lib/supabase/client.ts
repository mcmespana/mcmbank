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

// IDENTITY LOCK — completely disables navigator.locks-based cross-tab
// coordination. The user's console showed getSession() and self-heal hanging
// 8 s+ even after our 2 s lockWithFallback. Stack trace was full of
// postMessage loops + uf/uc reconciliation. The lock itself is the root
// cause of the deadlock; coordinating between tabs isn't worth the bug.
//
// Trade-off: if the user has *two* tabs of this app open and both refresh
// the token simultaneously, one refresh-token round-trip will fail and that
// tab will retry. Vastly preferable to "F5 and pray" recovery.
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
    autoRefreshToken: false,
  },
})

export function createClient() {
  return supabase
}

// Nuclear recovery — clears every Supabase auth artifact from the browser
// and reloads. Used by StuckRecoveryBanner when normal reset can't unstick
// a wedged session. After this, user has to log in again.
export function nukeSupabaseStorageAndReload(): void {
  try {
    if (typeof window !== "undefined") {
      // localStorage entries
      const lsKeys = Object.keys(window.localStorage)
      for (const k of lsKeys) {
        if (k.startsWith("sb-") || k.toLowerCase().includes("supabase")) {
          try {
            window.localStorage.removeItem(k)
          } catch {}
        }
      }
      // sessionStorage entries
      try {
        const ssKeys = Object.keys(window.sessionStorage)
        for (const k of ssKeys) {
          if (k.startsWith("sb-") || k.toLowerCase().includes("supabase")) {
            window.sessionStorage.removeItem(k)
          }
        }
      } catch {}
      // cookies (best-effort — HttpOnly cookies are server-only and survive)
      try {
        const cookies = document.cookie.split(";")
        for (const c of cookies) {
          const eq = c.indexOf("=")
          const name = (eq > -1 ? c.substring(0, eq) : c).trim()
          if (name.startsWith("sb-") || name.toLowerCase().includes("supabase")) {
            const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT"
            document.cookie = `${name}=; ${expire}; path=/`
            document.cookie = `${name}=; ${expire}; path=/; domain=${window.location.hostname}`
          }
        }
      } catch {}
    }
  } finally {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }
}
