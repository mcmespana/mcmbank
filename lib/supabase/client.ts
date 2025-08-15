import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  )
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

export function createClient() {
  return supabase
}

