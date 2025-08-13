"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { DelegationProvider, useDelegationContext } from "@/contexts/delegation-context"

interface AppLayoutProps {
  children: React.ReactNode
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const { selectedDelegation, setSelectedDelegation } = useDelegationContext()

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Topbar */}
        <Topbar selectedDelegation={selectedDelegation} onDelegationChange={setSelectedDelegation} />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DelegationProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </DelegationProvider>
  )
}
