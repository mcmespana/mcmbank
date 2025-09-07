"use client"

import type React from "react"
import { AuthProvider } from "./auth-context"
import { DelegationProvider } from "./delegation-context"
import { ThemeProvider } from "@/components/theme-provider"
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
      <AuthProvider>
        <DelegationProvider>
          <ConnectionMonitor />
          {children}
          <Toaster richColors />
        </DelegationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
