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
    <header className="relative sticky top-6 z-40 mx-auto flex h-16 w-full max-w-7xl items-center gap-4 rounded-2xl border border-white/30 bg-background/80 px-3 shadow-[0_25px_65px_-35px_rgba(37,99,235,0.65)] backdrop-blur-xl transition-all sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute -left-24 top-[-100px] h-56 w-56 rounded-full bg-primary/20 blur-3xl dark:bg-primary/15" />
        <div className="absolute right-[-40px] top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-sky-500/20 blur-[120px] dark:bg-sky-500/15" />
      </div>

      <Sidebar showDesktop={false} />

      <div className="flex flex-1 items-center gap-3">
        <div className="hidden w-full max-w-sm sm:flex">
          <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
        </div>
        <div className="flex w-full sm:hidden">
          <div className="w-full rounded-full border border-white/30 bg-white/70 px-3 py-1.5 text-sm text-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
            <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualClick}
          className="hidden rounded-full border border-transparent bg-white/40 px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/60 hover:text-foreground dark:bg-white/10 dark:text-white sm:inline-flex"
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Manual
        </Button>

        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full border border-white/30 bg-white/50 text-foreground/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:text-foreground dark:border-white/10 dark:bg-white/10 dark:text-white"
            onClick={handleThemeCycle}
            title={`Cambiar tema (actual: ${currentThemeLabel})`}
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        )}

        <div className="flex items-center gap-3 rounded-full border border-white/30 bg-white/60 px-3 py-2 shadow-sm transition-all duration-200 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-white/40 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/10">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="text-xs font-medium">
                {getUserInitials(perfil?.nombre_completo, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start text-sm leading-tight">
              <span className="font-semibold text-foreground dark:text-white">
                {getUserDisplayName()}
              </span>
              {user?.email && (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9 rounded-full border border-transparent text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-500/20 hover:text-red-600 dark:hover:border-red-500/40 dark:hover:bg-red-500/20 dark:hover:text-red-300"
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
