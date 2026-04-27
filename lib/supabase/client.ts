import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

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
  auth: { lock: noLock },
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
