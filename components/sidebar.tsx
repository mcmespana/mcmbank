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
  Bell,
  Banknote,
  Settings,
  Users,
  Zap,
  Activity,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
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
      name: "Diagnóstico",
      href: "/diagnostico",
      icon: Activity,
      count: null,
      enabled: true,
    },
  ]

  return (
    <div className={cn("flex h-full flex-col bg-sidebar", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <button
          type="button"
          onClick={() => {
            try {
              window.location.assign("/")
            } catch {
              // no-op
            }
          }}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          title="Ir al inicio"
        >
          <Building2 className="h-8 w-8 text-sidebar-primary" />
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground">MCM Bank</span>}
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
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isDisabled
                  ? "text-muted-foreground cursor-not-allowed opacity-50"
                  : isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {!collapsed && <span>{item.name}</span>}
              </div>
              {!collapsed && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    isDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-sidebar-primary text-sidebar-primary-foreground",
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
          <div className="absolute -right-3 top-8">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full bg-background border-2 shadow-md"
              onClick={onToggleCollapse}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
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
            <SidebarContent counts={counts} countsLoading={countsLoading} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
