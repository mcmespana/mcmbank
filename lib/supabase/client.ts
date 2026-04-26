import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  )
}

// navigator.locks can deadlock when Chrome suspends/restores a background tab
// (the lock held by the suspended context is never released). The default
// lockAcquireTimeout is 10 s, after which GoTrueClient throws and AuthContext
// sets user=null — wiping all delegation/category data without any visible error.
//
// Fix: abort the lock request after 5 s and run the fn() without coordination.
// Worst-case: two concurrent token refreshes across tabs (one refresh-token
// round-trip fails), which is far better than a silent full-app data loss.
async function lockWithFallback<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return fn()
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 5000)

  try {
    return await navigator.locks.request(name, { mode: "exclusive", signal: ac.signal }, async () => {
      clearTimeout(timer)
      return await fn()
    })
  } catch (e: any) {
    clearTimeout(timer)
    if (e?.name === "AbortError") {
      // Lock timed out — run without cross-tab coordination as fallback.
      return await fn()
    }
    throw e
  }
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { lock: lockWithFallback },
})

export function createClient() {
  return supabase
}
