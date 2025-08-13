import { MockAdapter } from "./mock-adapter"

// Export the current data adapter - can be switched to SupabaseAdapter later
export const dataAdapter = new MockAdapter()

// For future Supabase integration:
// export const dataAdapter = new SupabaseAdapter();
