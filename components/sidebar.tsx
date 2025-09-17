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
        "relative flex h-full flex-col overflow-hidden border-r border-sidebar-border/40 bg-sidebar text-sidebar-foreground shadow-[0_25px_55px_-25px_rgba(15,63,118,0.45)] backdrop-blur-xl",
        "dark:border-white/5",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-[-140px] h-72 w-72 rounded-full bg-primary/30 blur-3xl dark:bg-primary/20" />
        <div className="absolute bottom-[-180px] right-[-140px] h-80 w-80 rounded-full bg-sky-500/30 blur-[140px] dark:bg-sky-500/20" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex h-20 items-center border-b border-white/10 px-6">
        <button
          type="button"
          onClick={() => {
            try {
              window.location.assign("/")
            } catch {
              // no-op
            }
          }}
          className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/60 px-3 py-2 text-left text-sidebar-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-white"
          title="Ir al inicio"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/90 text-primary-foreground shadow-[0_18px_45px_-18px_rgba(37,99,235,0.7)]">
            <Building2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">
              MCM Bank
            </span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 space-y-2 px-4 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled

          const linkContent = (
            <div
              className={cn(
                "group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 before:absolute before:inset-0 before:-z-10 before:bg-white/40 before:opacity-0 before:blur-xl before:transition before:duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:before:opacity-100 dark:before:bg-white/10",
                isDisabled
                  ? "cursor-not-allowed text-muted-foreground/70 hover:translate-y-0 hover:shadow-none hover:before:opacity-0"
                  : isActive
                    ? "bg-gradient-to-r from-primary via-primary to-sky-500 text-primary-foreground shadow-[0_20px_45px_-20px_rgba(37,99,235,0.75)] before:opacity-100 before:bg-white/20 dark:before:bg-white/5"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground dark:text-sidebar-foreground/80 dark:hover:text-white",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-white/40 bg-white/70 text-sidebar-foreground/80 shadow-sm transition-all duration-200 dark:border-white/10 dark:bg-white/10 dark:text-sidebar-foreground",
                    isActive && "border-transparent bg-white/90 text-primary shadow-[0_14px_35px_-18px_rgba(37,99,235,0.6)] dark:bg-white/10 dark:text-primary-foreground",
                    isDisabled && "opacity-50",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                {!collapsed && <span className="truncate">{item.name}</span>}
              </div>
              {!collapsed && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                    isDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-white/70 text-sidebar-foreground shadow-sm dark:bg-white/10 dark:text-white",
                  )}
                >
                  {item.count}
                </span>
              )}
            </div>
          )

          if (isDisabled) {
            return (
              <div key={item.name} className="opacity-80">
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
            collapsed ? "lg:w-16" : "lg:w-72",
          )}
        >
          <SidebarContent collapsed={collapsed} counts={counts} countsLoading={countsLoading} />

          {/* Collapse Toggle Button */}
          <div className="absolute -right-3 top-10">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border border-white/40 bg-white/70 text-sidebar-foreground shadow-[0_18px_35px_-18px_rgba(37,99,235,0.55)] transition-transform duration-200 hover:scale-105 hover:shadow-[0_24px_55px_-20px_rgba(37,99,235,0.65)] dark:border-white/10 dark:bg-white/10 dark:text-white"
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
          <SheetContent side="left" className="w-72 border-none bg-transparent p-0 backdrop-blur-2xl">
            <SidebarContent counts={counts} countsLoading={countsLoading} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
