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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // Solo la lógica que se puede probar sin navegador ni red. Los
      // componentes de React quedan fuera a propósito: el entorno es `node`,
      // así que aparecerían siempre a 0 y ensuciarían la métrica.
      include: ["lib/**/*.ts", "hooks/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "lib/test-utils/**",
        // Tipos generados y catálogos de tipos: no hay nada que ejecutar.
        "lib/types/supabase-generated.ts",
        "lib/types/**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
