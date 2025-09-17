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
}

export function AppLayout({ children }: AppLayoutProps) {
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,110,255,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,_rgba(19,49,111,0.35),_transparent_60%)]" />
        <div className="rounded-2xl border border-white/10 bg-background/80 px-10 py-12 text-center backdrop-blur-lg shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {isRedirecting ? "Redirigiendo a la zona segura..." : "Preparando tu área de trabajo..."}
          </p>
        </div>
      </div>
    )
  }

  // Don't render anything if no user (will redirect)
  if (!user) {
    return null
  }

  return (
    <div className="relative flex min-h-screen text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-slate-950/80 via-transparent" />
      </div>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        showMobileTrigger={false}
      />

      <div
        className={cn(
          "relative z-10 flex min-h-screen flex-1 flex-col transition-[padding] duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72",
        )}
      >
        <Topbar selectedDelegation={selectedDelegation} onDelegationChange={(id) => setSelectedDelegation(id)} />

        <main className="flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
