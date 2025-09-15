"use client"

import { DelegationSelector } from "./delegation-selector"
import { Sidebar } from "./sidebar"
import { useAuth } from "@/contexts/auth-context"
import { usePerfil } from "@/hooks/use-perfil"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { User, LogOut, Moon, Sun, BookOpen, Monitor } from "lucide-react"
import { useEffect, useState } from "react"

interface TopbarProps {
  selectedDelegation?: string | null
  onDelegationChange?: (delegationId: string) => void
}

export function Topbar({ selectedDelegation, onDelegationChange }: TopbarProps) {
  const { user, signOut } = useAuth()
  const { perfil, loading } = usePerfil()
  const { resolvedTheme, setTheme, theme } = useTheme()
  
  // Handle hydration mismatch for theme
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

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

  const themePreference = theme ?? "system"
  const isSystemPreference = themePreference === "system"
  const activeTheme = resolvedTheme ?? "light"
  const themeLabels: Record<string, string> = {
    light: "Claro",
    dark: "Oscuro",
    system: "Según dispositivo",
  }

  const themeButtonTitle = isSystemPreference
    ? `Tema: ${themeLabels[activeTheme]} (según dispositivo)`
    : `Tema: ${themeLabels[themePreference]}`

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative w-9 h-9 p-0"
                title={themeButtonTitle}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                {isSystemPreference && (
                  <Monitor className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="sr-only">Cambiar tema</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Modo de apariencia</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={themePreference}
                onValueChange={(value) => setTheme(value)}
              >
                <DropdownMenuRadioItem value="light" className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  <span>Claro</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  <span>Oscuro</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Según dispositivo</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User info and logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-border">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="text-xs font-medium">
                {getUserInitials(perfil?.nombre_completo, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start text-sm">
              <span className="font-medium text-foreground leading-none">
                {getUserDisplayName()}
              </span>
              {user?.email && (
                <span className="text-xs text-muted-foreground mt-0.5">
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
