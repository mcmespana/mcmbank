import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time or if env vars are missing, return a placeholder
  // This allows static generation to complete without errors
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      // During SSR/build, return a mock that won't be used
      return null as unknown as ReturnType<typeof createBrowserClient<Database>>
    }
    throw new Error(
      "Supabase environment variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    )
  }

  supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Lazy getter for backward compatibility
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
  get(_, prop) {
    const client = getSupabaseClient()
    if (!client) {
      // Return a no-op function for method calls during SSR/build
      return () => Promise.resolve({ data: null, error: null })
    }
    return Reflect.get(client, prop)
  },
})

export function createClient() {
  return getSupabaseClient()
}
