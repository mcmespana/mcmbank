import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include: ['components/**/*.test.ts', 'components/**/*.test.tsx', 'lib/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
