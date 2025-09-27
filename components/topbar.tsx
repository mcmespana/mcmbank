"use client"

import { DelegationSelector } from "./delegation-selector"
import { Sidebar } from "./sidebar"
import { useAuth } from "@/contexts/auth-context"
import { usePerfil } from "@/hooks/use-perfil"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, BookOpen, Moon, Sun, Monitor, ChevronDown, Sparkles } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

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
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {/* Mobile menu button */}
      <Sidebar showDesktop={false} />

      {/* Delegation selector */}
      <div className="flex items-center gap-4">
        <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Manual/Documentation button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleManualClick}
          className="hidden sm:inline-flex"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Manual
        </Button>

        {/* Theme toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0"
            onClick={handleThemeCycle}
            title={`Cambiar tema (actual: ${currentThemeLabel})`}
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        )}

        {/* User info and logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menú de perfil y acciones personales"
                className="group flex items-center gap-3 rounded-full border border-transparent bg-transparent px-2 py-1.5 text-left transition hover:border-border/80 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-border/60 shadow-sm">
                    <AvatarImage src="" alt={getUserDisplayName()} />
                    <AvatarFallback className="text-xs font-medium">
                      {getUserInitials(perfil?.nombre_completo, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start text-sm">
                    <span className="font-semibold text-foreground leading-none">
                      {getUserDisplayName()}
                    </span>
                    {user?.email && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[18rem]">
              <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground/70">
                <Sparkles className="h-4 w-4 text-primary" />
                Centro de control personal
              </DropdownMenuLabel>
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background/90 to-muted/60 p-3">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground/70">Sesión activa</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{getUserDisplayName()}</p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/perfil/cambiar-contrasena" className="flex w-full items-center justify-between">
                  <span>Cambiar contraseña</span>
                  <span className="text-xs text-muted-foreground">Seguro y elegante</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/40"
                onSelect={(event) => {
                  event.preventDefault()
                  handleSignOut()
                }}
              >
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 w-9 h-9 p-0"
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
