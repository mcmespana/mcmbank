"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { selectedDelegation, setSelectedDelegation } = useDelegationContext()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!loading && !user && !isRedirecting) {
      setIsRedirecting(true)
      router.push("/auth/login")
    }
  }, [user, loading, router, isRedirecting])

  // Show loading state while auth is loading or redirecting
  if (loading || isRedirecting) {
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
