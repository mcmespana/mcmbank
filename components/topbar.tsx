"use client"

import { DelegationSelector } from "./delegation-selector"
import { Sidebar } from "./sidebar"
import { useAuth } from "@/contexts/auth-context"
import { usePerfil } from "@/hooks/use-perfil"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, BookOpen, Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"

interface TopbarProps {
  selectedDelegation?: string | null
  onDelegationChange?: (delegationId: string) => void
}

export function Topbar({ selectedDelegation, onDelegationChange }: TopbarProps) {
  const { user, signOut } = useAuth()
  const { perfil, loading } = usePerfil()
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const themePreference = theme ?? "system"
  const themeOrder = useMemo(() => ["system", "light", "dark"] as const, [])
  const themeIcons: Record<(typeof themeOrder)[number], typeof Sun> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const themeLabels: Record<(typeof themeOrder)[number], string> = {
    light: "Modo claro",
    dark: "Modo oscuro",
    system: "Según dispositivo",
  }

  const currentThemeKey = useMemo(() => {
    return themeOrder.includes(themePreference as typeof themeOrder[number])
      ? (themePreference as typeof themeOrder[number])
      : "system"
  }, [themeOrder, themePreference])

  const nextTheme = useMemo(() => {
    const currentIndex = themeOrder.indexOf(currentThemeKey)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    return themeOrder[nextIndex]
  }, [themeOrder, currentThemeKey])

  const handleThemeCycle = () => {
    const newTheme = nextTheme
    setTheme(newTheme)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mcmbank-theme", newTheme)
    }
  }

  const ThemeIcon = themeIcons[currentThemeKey]
  const currentThemeLabel = themeLabels[currentThemeKey]
  const getUserInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      return name
        .split(" ")
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (!email) return "U"
    return email
      .split("@")[0]
      .split(".")
      .map(part => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserDisplayName = () => {
    if (loading) return "Cargando..."
    if (perfil?.nombre_completo && perfil.nombre_completo.trim()) {
      return perfil.nombre_completo
    }
    if (user?.email) {
      return user.email
        .split("@")[0]
        .split(".")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    }
    return "Usuario"
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleManualClick = () => {
    const manualUrl = process.env.NEXT_PUBLIC_URL_MANUAL || process.env.URL_MANUAL
    if (manualUrl) {
      window.open(manualUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <header className="relative sticky top-0 z-40 flex h-20 items-center gap-4 border-b border-white/10 bg-slate-950/50 px-4 shadow-[0_10px_30px_-20px_rgba(16,76,140,0.9)] backdrop-blur-xl transition-colors lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(40,83,195,0.22),transparent_60%)]" />
      {/* Mobile menu button */}
      <Sidebar showDesktop={false} />

      {/* Delegation selector */}
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-2 shadow-inner">
          <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Manual/Documentation button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualClick}
          className="hidden rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10 sm:inline-flex"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Manual
        </Button>

        {/* Theme toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 rounded-full border border-white/10 bg-white/5 p-0 text-slate-200 transition hover:bg-white/10"
            onClick={handleThemeCycle}
            title={`Cambiar tema (actual: ${currentThemeLabel})`}
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        )}

        {/* User info and logout */}
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 border border-white/10 bg-slate-900/80 text-slate-100">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="text-xs font-medium text-white">
                {getUserInitials(perfil?.nombre_completo, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start text-sm">
              <span className="font-medium leading-none text-white">
                {getUserDisplayName()}
              </span>
              {user?.email && (
                <span className="mt-0.5 text-xs text-slate-300/80">
                  {user.email}
                </span>
              )}
            </div>
          </div>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 p-0 text-slate-200 transition hover:bg-red-500/10 hover:text-red-200"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Cerrar sesión</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
