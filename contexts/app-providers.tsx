"use client"

import type React from "react"
import { AuthProvider } from "./auth-context"
import { DelegationProvider } from "./delegation-context"
import { ConnectionMonitor } from "@/components/connection-monitor"

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <DelegationProvider>
        <ConnectionMonitor />
        {children}
      </DelegationProvider>
    </AuthProvider>
  )
}
