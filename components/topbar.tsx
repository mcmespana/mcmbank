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
    // Flag de "ya hidratado en el cliente" para evitar mismatch de SSR con el
    // tema; no hay forma de derivarlo sin un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center gap-1.5 sm:gap-2 lg:gap-4 border-b border-border/30 bg-background/80 backdrop-blur-2xl shadow-sm px-2 sm:px-4 lg:px-6 overflow-hidden">
      {/* Mobile menu button - fixed width */}
      <div className="flex-shrink-0">
        <Sidebar showDesktop={false} />
      </div>

      {/* Delegation selector. En móvil ocupa todo el espacio libre (antes tenía
          un max-w de 160px y el spacer se quedaba el resto, así que el nombre de
          la delegación se truncaba a ~50px: "-T M..."). En sm+ recupera el ancho
          acotado y es el spacer el que empuja las acciones a la derecha. */}
      <div className="flex flex-1 items-center min-w-0 overflow-hidden sm:flex-none sm:max-w-[280px] md:max-w-[320px]">
        <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
      </div>

      {/* Spacer */}
      <div className="hidden sm:block sm:flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Manual/Documentation button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualClick}
          className="hidden sm:inline-flex gap-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors duration-150"
        >
          <BookOpen className="h-4 w-4" />
          <span>Manual</span>
        </Button>

        {/* Theme toggle. Oculto en móvil (< sm): vive en el menú lateral
            (hamburguesa), donde no compite por espacio con el nombre de la
            delegación, que es la información que más importa poder leer. */}
        {mounted && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-[background-color,color] duration-150 flex-shrink-0"
            onClick={handleThemeCycle}
            title={`Cambiar tema (actual: ${currentThemeLabel})`}
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        )}

        {/* User info and logout. Oculto en móvil por el mismo motivo: ambos
            están duplicados en el pie del menú lateral (components/sidebar.tsx). */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-3 pl-2 sm:pl-3 ml-1 sm:ml-2 border-l border-border/30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 bg-card/50 backdrop-blur-sm rounded-2xl px-2 sm:px-3 py-1.5 border border-border/30 shadow-sm">
            <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary/20 ring-offset-0 sm:ring-offset-2 ring-offset-background flex-shrink-0">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                {getUserInitials(perfil?.nombre_completo, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start text-sm min-w-0">
              <span className="font-semibold text-foreground leading-none truncate max-w-[180px] text-sm">
                {getUserDisplayName()}
              </span>
              {user?.email && (
                <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
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
            className="text-muted-foreground hover:text-red-600 hover:bg-red-500/10 w-9 h-9 sm:w-10 sm:h-10 p-0 rounded-xl transition-[background-color,color] duration-150 flex-shrink-0"
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
