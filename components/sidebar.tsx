"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  Building2,
  FileText,
  BarChart3,
  Banknote,
  HandCoins,
  Settings,
  Users,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  BookOpen,
  Moon,
  Sun,
  Monitor,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import useIsAdmin from "@/hooks/use-is-admin"
import { useDelegationCounts } from "@/hooks/use-delegation-counts"
import type { DelegationCounts } from "@/hooks/use-delegation-counts"
import { useAuth } from "@/contexts/auth-context"
import { usePerfil } from "@/hooks/use-perfil"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"

interface SidebarContentProps {
  className?: string
  collapsed?: boolean
  counts: DelegationCounts
  countsLoading: boolean
  // Pie con tema/manual/logout. Solo se pasa true en el Sheet móvil: en
  // desktop esas acciones ya viven en el topbar y duplicarlas sería ruido.
  accountFooter?: boolean
  // Solo lo pasa el Sheet móvil: al navegar hay que cerrar el panel para
  // descubrir la página a la que se acaba de ir.
  onNavigate?: () => void
}

function SidebarContent({ className, collapsed = false, counts, countsLoading, accountFooter = false, onNavigate }: SidebarContentProps) {
  const pathname = usePathname()
  const isAdmin = useIsAdmin()

  // Datos de cuenta/tema — solo se pintan cuando accountFooter=true (Sheet
  // móvil), pero los hooks se llaman siempre para no romper las reglas de
  // hooks (el componente puede pasar de accountFooter=false a true si cambia
  // de instancia desktop/mobile).
  const { user, signOut } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
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
  const currentThemeKey = useMemo(
    () => (themeOrder.includes(themePreference as typeof themeOrder[number]) ? (themePreference as typeof themeOrder[number]) : "system"),
    [themeOrder, themePreference],
  )
  const nextTheme = useMemo(() => {
    const currentIndex = themeOrder.indexOf(currentThemeKey)
    return themeOrder[(currentIndex + 1) % themeOrder.length]
  }, [themeOrder, currentThemeKey])
  const handleThemeCycle = () => {
    setTheme(nextTheme)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mcmbank-theme", nextTheme)
    }
  }
  const ThemeIcon = themeIcons[currentThemeKey]
  const currentThemeLabel = themeLabels[currentThemeKey]

  const getUserInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      return name.split(" ").map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2)
    }
    if (!email) return "U"
    return email.split("@")[0].split(".").map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2)
  }
  const getUserDisplayName = () => {
    if (perfilLoading) return "Cargando..."
    if (perfil?.nombre_completo && perfil.nombre_completo.trim()) return perfil.nombre_completo
    if (user?.email) {
      return user.email.split("@")[0].split(".").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
    }
    return "Usuario"
  }
  const handleManualClick = () => {
    const manualUrl = process.env.NEXT_PUBLIC_URL_MANUAL || process.env.URL_MANUAL
    if (manualUrl) window.open(manualUrl, "_blank", "noopener,noreferrer")
  }
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const getCountBadge = (value: number | null) => {
    if (typeof value === "number") {
      return value
    }
    return countsLoading ? "…" : null
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      count: null,
      attention: false,
      enabled: true,
    },
    {
      name: "Movimientos",
      href: "/transacciones",
      icon: ArrowLeftRight,
      count: getCountBadge(counts.movimientos),
      attention: false,
      enabled: true,
    },
    {
      name: "Categorías",
      href: "/categorias",
      icon: Tag,
      count: getCountBadge(counts.categorias),
      attention: false,
      enabled: true,
    },
    {
      name: "Cuentas",
      href: "/cuentas",
      icon: Banknote,
      count: getCountBadge(counts.cuentas),
      attention: false,
      enabled: true,
    },
    {
      name: "Pagos MCM",
      href: "/pagos-mcm",
      icon: HandCoins,
      count: getCountBadge(counts.pagosMcmPendientes),
      attention: false,
      enabled: true,
    },
    {
      name: "Facturas",
      href: "/facturas",
      icon: FileText,
      count: getCountBadge(counts.facturasAtencion),
      // Bandeja o pendientes de pago: piden que alguien las mire, así que el
      // número lleva un color de aviso en vez del neutro del resto de badges.
      attention: true,
      enabled: true,
    },
    {
      name: "Informes",
      href: "/informes",
      icon: BarChart3,
      count: null,
      attention: false,
      enabled: true,
    },
    {
      name: "Contactos",
      href: "/contactos",
      icon: Users,
      count: getCountBadge(counts.contactos),
      attention: false,
      enabled: true,
    },
    ...(isAdmin
      ? [
        {
          name: "Configuración",
          href: "/configuracion",
          icon: Settings,
          count: null,
          attention: false,
          enabled: true,
        },
      ]
      : []),
    {
      name: "Propuestas",
      href: "/propuestas",
      icon: Sparkles,
      count: null,
      attention: false,
      enabled: true,
    },
  ]

  return (
    <div className={cn("flex h-full flex-col bg-sidebar border-r border-sidebar-border/50", className)}>
      {/* Logo */}
      <div className={cn("flex h-16 items-center border-b border-sidebar-border/30 bg-gradient-to-r from-primary/5 to-transparent", collapsed ? "justify-center px-2" : "px-6")}>
        <button
          type="button"
          onClick={() => {
            try {
              window.location.assign("/")
            } catch {
              // no-op
            }
          }}
          className="flex items-center gap-3 transition-opacity duration-200 hover:opacity-80"
          title="Ir al inicio"
        >
          <div className="bg-primary p-2 rounded-md flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground">MCM Bank</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 min-h-0 space-y-1 overflow-y-auto overscroll-contain", collapsed ? "px-2 py-4" : "p-4")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled
          // Facturas en bandeja o sin pagar piden que alguien las mire, así
          // que su número lleva un color de aviso en vez del neutro de un
          // simple contador informativo (movimientos, categorías…).
          const hasAttention = item.attention && item.count !== null && item.count !== 0 && !isDisabled

          // Modo encogido: solo icono, centrado, con indicador de activo y tooltip nativo
          const linkContent = collapsed ? (
            <div
              className={cn(
                "relative mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-transparent transition-colors duration-200",
                isDisabled
                  ? "text-muted-foreground cursor-not-allowed opacity-40"
                  : isActive
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
              title={item.name}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {/* Indicador de sección activa */}
              {isActive && (
                <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              {/* Punto de aviso si hay contador (sin número, no cabe) */}
              {item.count !== null && item.count !== 0 && !isDisabled && (
                <span
                  className={cn(
                    "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                    hasAttention ? "bg-amber-500" : "bg-primary",
                  )}
                />
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center justify-between rounded-md border border-transparent px-4 py-3 text-sm font-medium transition-colors duration-200 relative group",
                isDisabled
                  ? "text-muted-foreground cursor-not-allowed opacity-50"
                  : isActive
                    ? "bg-gradient-to-r from-primary/20 to-primary/10 text-sidebar-accent-foreground shadow-md border-primary/30"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors duration-200 flex-shrink-0",
                  isActive ? "bg-primary/20 shadow-sm" : "group-hover:bg-primary/10"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{item.name}</span>
              </div>
              {item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm relative z-10",
                    isDisabled
                      ? "bg-muted text-muted-foreground"
                      : hasAttention
                        ? "bg-amber-500 text-white border border-amber-600/30"
                        : "bg-primary/90 text-primary-foreground border border-primary/20",
                  )}
                >
                  {item.count}
                </span>
              )}
            </div>
          )

          if (isDisabled) {
            return <div key={item.name}>{linkContent}</div>
          }

          return (
            <Link key={item.name} href={item.href} onClick={onNavigate}>
              {linkContent}
            </Link>
          )
        })}
      </nav>

      {/* Pie de cuenta — solo en el Sheet móvil (accountFooter=true). En
          desktop estas acciones ya están en el topbar; duplicarlas aquí sería
          ruido. Mueve tema/manual/logout fuera del topbar en móvil, donde no
          había hueco para el nombre de la delegación. */}
      {accountFooter && (
        <div className="border-t border-sidebar-border/30 p-4 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border/30 bg-card/50 px-3 py-2">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20 flex-shrink-0">
              <AvatarImage src="" alt={getUserDisplayName()} />
              <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                {getUserInitials(perfil?.nombre_completo, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground text-sm truncate">{getUserDisplayName()}</span>
              {user?.email && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {mounted && (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                onClick={handleThemeCycle}
                title={`Cambiar tema (actual: ${currentThemeLabel})`}
              >
                <ThemeIcon className="h-4 w-4" />
                Tema
              </Button>
            )}
            <Button variant="outline" size="sm" className="justify-start gap-2" onClick={handleManualClick}>
              <BookOpen className="h-4 w-4" />
              Manual
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-2 text-red-600 dark:text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  showDesktop?: boolean
  showMobileTrigger?: boolean
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  showDesktop = true,
  showMobileTrigger = true,
}: SidebarProps) {
  const { counts, loading: countsLoading } = useDelegationCounts()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      {showDesktop && (
        <div
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-[width] duration-300",
            collapsed ? "lg:w-16" : "lg:w-72",
          )}
        >
          <SidebarContent collapsed={collapsed} counts={counts} countsLoading={countsLoading} />

          {/* Collapse Toggle Button */}
          <div className="absolute -right-4 top-10">
            <Button
              variant="outline"
              size="icon"
              className="relative h-8 w-8 rounded-full bg-card border border-border shadow-sm hover:bg-muted hover:border-foreground/20 transition-[background-color,border-color] duration-150 after:absolute after:-inset-1 after:content-['']"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
              title={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      {showMobileTrigger && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menú de Navegación</SheetTitle>
              <SheetDescription>Accede a las diferentes secciones bancarias</SheetDescription>
            </SheetHeader>
            <SidebarContent
              counts={counts}
              countsLoading={countsLoading}
              accountFooter
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

