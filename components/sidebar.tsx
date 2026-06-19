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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import useIsAdmin from "@/hooks/use-is-admin"
import { useDelegationCounts } from "@/hooks/use-delegation-counts"
import type { DelegationCounts } from "@/hooks/use-delegation-counts"

interface SidebarContentProps {
  className?: string
  collapsed?: boolean
  counts: DelegationCounts
  countsLoading: boolean
}

function SidebarContent({ className, collapsed = false, counts, countsLoading }: SidebarContentProps) {
  const pathname = usePathname()
  const isAdmin = useIsAdmin()

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
      enabled: true,
    },
    {
      name: "Movimientos",
      href: "/transacciones",
      icon: ArrowLeftRight,
      count: getCountBadge(counts.movimientos),
      enabled: true,
    },
    {
      name: "Categorías",
      href: "/categorias",
      icon: Tag,
      count: getCountBadge(counts.categorias),
      enabled: true,
    },
    {
      name: "Cuentas",
      href: "/cuentas",
      icon: Banknote,
      count: getCountBadge(counts.cuentas),
      enabled: true,
    },
    {
      name: "Pagos MCM",
      href: "/pagos-mcm",
      icon: HandCoins,
      count: getCountBadge(counts.pagosMcmPendientes),
      enabled: true,
    },
    {
      name: "Facturas",
      href: "/facturas",
      icon: FileText,
      count: null,
      enabled: false,
    },
    {
      name: "Informes",
      href: "/informes",
      icon: BarChart3,
      count: null,
      enabled: true,
    },
    {
      name: "Contactos",
      href: "/contactos",
      icon: Users,
      count: getCountBadge(counts.contactos),
      enabled: true,
    },
    ...(isAdmin
      ? [
        {
          name: "Configuración",
          href: "/configuracion",
          icon: Settings,
          count: null,
          enabled: true,
        },
      ]
      : []),
    {
      name: "Propuestas",
      href: "/propuestas",
      icon: Sparkles,
      count: null,
      enabled: true,
    },
  ]

  return (
    <div className={cn("flex h-full flex-col bg-sidebar/95 backdrop-blur-2xl border-r border-sidebar-border/50", className)}>
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
          <div className="bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl shadow-lg flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-transparent">MCM Bank</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 min-h-0 space-y-1 overflow-y-auto overscroll-contain", collapsed ? "px-2 py-4" : "p-4")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled

          // Modo encogido: solo icono, centrado, con indicador de activo y tooltip nativo
          const linkContent = collapsed ? (
            <div
              className={cn(
                "relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors duration-200",
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
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border border-transparent px-4 py-3 text-sm font-medium transition-colors duration-200 relative group",
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
            <Link key={item.name} href={item.href}>
              {linkContent}
            </Link>
          )
        })}
      </nav>
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

  return (
    <>
      {/* Desktop Sidebar */}
      {showDesktop && (
        <div
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
            collapsed ? "lg:w-16" : "lg:w-72",
          )}
        >
          <SidebarContent collapsed={collapsed} counts={counts} countsLoading={countsLoading} />

          {/* Collapse Toggle Button */}
          <div className="absolute -right-4 top-10">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full bg-card/90 backdrop-blur-xl border-2 border-border/50 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
              onClick={onToggleCollapse}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      {showMobileTrigger && (
        <Sheet>
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
            <SidebarContent counts={counts} countsLoading={countsLoading} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

