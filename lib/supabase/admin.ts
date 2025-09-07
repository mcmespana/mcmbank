import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Be tolerant to common typo: SUPABASE_SERVIC_ROLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVIC_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables")
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey)
}
