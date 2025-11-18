import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types/database"

// Mock client for build time when env vars are not available
const createMockClient = () => {
  const mockAuthResponse = { data: { session: null, user: null }, error: null }
  const mockDataResponse = { data: null, error: null }

  return {
    auth: {
      getSession: () => Promise.resolve(mockAuthResponse),
      getUser: () => Promise.resolve(mockAuthResponse),
      signOut: () => Promise.resolve(mockDataResponse),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(mockDataResponse),
          data: null,
          error: null
        })
      }),
      insert: () => Promise.resolve(mockDataResponse),
      update: () => ({ eq: () => Promise.resolve(mockDataResponse) }),
      delete: () => ({ eq: () => Promise.resolve(mockDataResponse) }),
    }),
  } as unknown as ReturnType<typeof createServerClient<Database>>
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, return a mock client to allow static generation
  if (!supabaseUrl || !supabaseAnonKey) {
    return createMockClient()
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => {
        const store = await cookies()
        return store.getAll()
      },
      setAll: async (cookiesToSet) => {
        try {
          const store = await cookies()
          for (const { name, value, options } of cookiesToSet) {
            await store.set(name, value, options)
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}
