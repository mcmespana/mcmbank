"use client"

import type React from "react"
import { AuthProvider } from "./auth-context"
import { DelegationProvider } from "./delegation-context"

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <DelegationProvider>{children}</DelegationProvider>
    </AuthProvider>
  )
}
