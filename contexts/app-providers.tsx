"use client"

import type React from "react"
import { AuthProvider } from "./auth-context"
import { DelegationProvider } from "./delegation-context"
import { MovimientosCacheProvider } from "./movimientos-cache-context"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeStateWatcher } from "@/components/theme-state-watcher"
import { ConnectionMonitor } from "@/components/connection-monitor"
import { Toaster } from "sonner"

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeStateWatcher />
      <AuthProvider>
        <DelegationProvider>
          <MovimientosCacheProvider>
            <ConnectionMonitor />
            {children}
            <Toaster richColors />
          </MovimientosCacheProvider>
        </DelegationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
