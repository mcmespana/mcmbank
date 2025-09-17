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
  Activity,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
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
    {
      name: "Propuestas",
      href: "/propuestas",
      icon: Sparkles,
      count: null,
      enabled: true,
    },
  ]

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-white/10 bg-sidebar text-sidebar-foreground shadow-[0_20px_45px_-25px_rgba(8,19,40,0.8)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(62,114,255,0.25),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[radial-gradient(80%_120%_at_100%_20%,rgba(12,33,71,0.65),transparent_70%)]" />

      <div className="relative flex h-20 items-center justify-between border-b border-white/10 px-5">
        <button
          type="button"
          onClick={() => {
            try {
              window.location.assign("/")
            } catch {
              // no-op
            }
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-white/10 hover:text-white"
          title="Ir al inicio"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary">
            <Building2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight">MCM Bank</span>
              <span className="text-xs uppercase tracking-[0.3em] text-sidebar-foreground/70">Tesorería viva</span>
            </div>
          )}
        </button>
      </div>

      <nav className="relative flex-1 space-y-1.5 px-3 py-5">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled

          const linkContent = (
            <div
              className={cn(
                "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all",
                isDisabled
                  ? "cursor-not-allowed text-sidebar-foreground/40"
                  : isActive
                    ? "bg-white/10 text-white shadow-[0_10px_30px_-15px_rgba(15,72,169,0.8)] backdrop-blur"
                    : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    !isDisabled && "group-hover:scale-110",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70",
                  )}
                />
                {!collapsed && <span>{item.name}</span>}
              </div>
              {!collapsed && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    isDisabled
                      ? "border-white/10 bg-white/5 text-sidebar-foreground/50"
                      : "border-sidebar-primary/40 bg-sidebar-primary/15 text-sidebar-primary-foreground",
                  )}
                >
                  {item.count}
                </span>
              )}
            </div>
          )

          if (isDisabled) {
            return (
              <div key={item.name} className="relative">
                {linkContent}
              </div>
            )
          }

          return (
            <Link key={item.name} href={item.href} className="block">
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
            collapsed ? "lg:w-20" : "lg:w-72",
          )}
        >
          <SidebarContent collapsed={collapsed} counts={counts} countsLoading={countsLoading} />

          {/* Collapse Toggle Button */}
          <div className="absolute -right-3 top-8">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full border-white/20 bg-slate-900/70 text-white shadow-lg backdrop-blur"
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
          <SheetContent side="left" className="w-72 border-white/10 bg-sidebar p-0 text-sidebar-foreground">
            <SidebarContent counts={counts} countsLoading={countsLoading} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
