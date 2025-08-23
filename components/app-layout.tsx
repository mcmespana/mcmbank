"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AppLayoutProps {
  children: React.ReactNode
  transactionCount?: number // Added prop for transaction count
}

export function AppLayout({ children, transactionCount }: AppLayoutProps) {
  const { selectedDelegation, setSelectedDelegation } = useDelegationContext()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user && !isRedirecting) {
      setIsRedirecting(true)
      router.push("/auth/login")
    }
  }, [user, loading, router, isRedirecting])

  // If a user appears (e.g., after sign-in finishes), clear redirecting state
  useEffect(() => {
    if (user && isRedirecting) {
      setIsRedirecting(false)
    }
  }, [user, isRedirecting])

  // Safety net: if stuck in redirecting state for a while, force a refresh/navigation
  useEffect(() => {
    if (!isRedirecting) return
    const t = setTimeout(() => {
      // Using a hard navigation ensures cookies/session are fully applied
      try {
        window.location.href = "/auth/login"
      } catch {
        // no-op
      }
    }, 500)
    return () => clearTimeout(t)
  }, [isRedirecting])

  // Show loading state while auth is loading or redirecting
  if (loading || (isRedirecting && !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{isRedirecting ? "Redirigiendo..." : "Cargando..."}</p>
        </div>
      </div>
    )
  }

  // Don't render anything if no user (will redirect)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        transactionCount={transactionCount} // Pass transaction count to sidebar
      />

      {/* Main Content */}
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-72")}>
        {/* Topbar */}
        <Topbar selectedDelegation={selectedDelegation} onDelegationChange={setSelectedDelegation} />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
