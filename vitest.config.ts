import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    // Dummy values so modules that construct the Supabase client at import
    // time (e.g. hooks/*.ts) don't throw during test collection. Tests here
    // exercise pure functions only; no real Supabase call is made.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
