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
      enabled: false,
    },
    {
      name: "Contactos",
      href: "/contactos",
      icon: Users,
      count: null,
      enabled: false,
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
          className="flex items-center gap-3 hover:opacity-90 transition-all duration-300 hover:scale-105"
          title="Ir al inicio"
        >
          <div className="bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl shadow-lg flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-transparent">MCM Bank</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled

          const linkContent = (
            <div
              className={cn(
                "flex items-center rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group",
                collapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3",
                isDisabled
                  ? "text-muted-foreground cursor-not-allowed opacity-50"
                  : isActive
                    ? "bg-gradient-to-r from-primary/20 to-primary/10 text-sidebar-accent-foreground shadow-md backdrop-blur-sm border border-primary/30"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-md hover:backdrop-blur-sm hover:scale-105 hover:border hover:border-sidebar-border/30",
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent animate-pulse" />
              )}
              <div className="flex items-center gap-3 relative z-10">
                <div className={cn(
                  "p-1.5 rounded-lg transition-all duration-300 flex-shrink-0",
                  isActive ? "bg-primary/20 shadow-sm" : "group-hover:bg-primary/10"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                {!collapsed && <span>{item.name}</span>}
              </div>
              {!collapsed && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm relative z-10",
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

