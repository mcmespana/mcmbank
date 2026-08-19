"use client"

import type React from "react"
import { AuthProvider } from "./auth-context"
import { DelegationProvider } from "./delegation-context"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeStateWatcher } from "@/components/theme-state-watcher"
import { ConnectionMonitor } from "@/components/connection-monitor"
import { QueryProvider } from "./query-provider"
import { AppToaster } from "@/components/app-toaster"

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
      <QueryProvider>
        <AuthProvider>
          <DelegationProvider>
            <ConnectionMonitor />
            {children}
            <AppToaster />
          </DelegationProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
