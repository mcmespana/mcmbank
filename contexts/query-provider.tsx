"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * Provider de TanStack Query. El QueryClient se crea una sola vez por montaje
 * (useState) para no recrearlo en cada render.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s: evita refetch agresivo al navegar
            refetchOnWindowFocus: true, // mismo comportamiento que los hooks actuales
            retry: 1,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
