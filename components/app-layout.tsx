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
  // El estado del sidebar arranca en `false` (igual en servidor y cliente) y se
  // hidrata desde localStorage en un efecto, evitando leer localStorage durante
  // el render (causa de mismatch de hidratación).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHydrated, setSidebarHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('mcmbank-sidebar-collapsed')
    if (saved === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarCollapsed(true)
    }
    setSidebarHydrated(true)
  }, [])

  // Persist sidebar state to localStorage (solo tras hidratar, para no
  // sobrescribir el valor guardado con el `false` inicial).
  useEffect(() => {
    if (!sidebarHydrated) return
    localStorage.setItem('mcmbank-sidebar-collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed, sidebarHydrated])

  useEffect(() => {
    if (!loading && !user && !isRedirecting) {
      // Reacción a un cambio de estado de auth asíncrono + navegación; es un
      // efecto legítimo, no estado derivable durante el render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRedirecting(true)
      router.push("/auth/login")
    }
  }, [user, loading, router, isRedirecting])

  // If a user appears (e.g., after sign-in finishes), clear redirecting state
  useEffect(() => {
    if (user && isRedirecting) {
      // Idem: sincroniza el flag de redirección con el estado de auth.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50 pointer-events-none" />
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl"></div>
          </div>
          <p className="text-muted-foreground text-lg font-medium">{isRedirecting ? "Redirigiendo..." : "Cargando..."}</p>
        </div>
      </div>
    )
  }

  // Don't render anything if no user (will redirect)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      {/* Subtle animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))] pointer-events-none" />

      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        showMobileTrigger={false}
      />

      {/* Main Content */}
      <div className={cn("transition-all duration-300 relative z-10", sidebarCollapsed ? "lg:pl-16" : "lg:pl-72")}>
        {/* Topbar */}
        <Topbar selectedDelegation={selectedDelegation} onDelegationChange={(id) => setSelectedDelegation(id)} />

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
