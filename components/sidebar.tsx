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

interface SidebarContentProps {
  className?: string
  collapsed?: boolean
  transactionCount?: number // Added transaction count prop
}

function SidebarContent({ className, collapsed = false, transactionCount }: SidebarContentProps) {
  const pathname = usePathname()

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
      count: transactionCount || 6, // Use dynamic transaction count
      enabled: true,
    },
    {
      name: "Categorías",
      href: "/categorias",
      icon: Tag,
      count: 7,
      enabled: true,
    },
    {
      name: "Cuentas",
      href: "/cuentas",
      icon: Banknote,
      count: 3,
      enabled: true,
    },
    {
      name: "Facturas",
      href: "/facturas",
      icon: FileText,
      count: 0,
      enabled: false,
    },
    {
      name: "Informes",
      href: "/informes",
      icon: BarChart3,
      count: 0,
      enabled: false,
    },
    {
      name: "Contactos",
      href: "/contactos",
      icon: Users,
      count: 14,
      enabled: false,
    },
    {
      name: "Configuración",
      href: "/configuracion",
      icon: Settings,
      count: null,
      enabled: false,
    },
    {
      name: "Diagnóstico",
      href: "/diagnostico",
      icon: Activity,
      count: null,
      enabled: true,
    },
  ]

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-primary" />
          {!collapsed && <span className="text-xl font-semibold">MCM Bank</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !item.enabled

          const linkContent = (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
                isDisabled
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center",
              )}
            >
              {isActive && !collapsed && (
                <div className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r-full" />
              )}
              <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
                <item.icon className="h-5 w-5" />
                {!collapsed && <span>{item.name}</span>}
              </div>
              {!collapsed && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {item.count}
                </span>
              )}
            </div>
          )

          if (isDisabled) {
            return (
              <div key={item.name} title={item.name}>
                {linkContent}
              </div>
            )
          }

          return (
            <Link key={item.name} href={item.href} title={item.name}>
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
  transactionCount?: number // Added transaction count prop
  showDesktop?: boolean
  showMobileTrigger?: boolean
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  transactionCount,
  showDesktop = true,
  showMobileTrigger = true,
}: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      {showDesktop && (
        <div
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out",
            collapsed ? "lg:w-20" : "lg:w-72",
          )}
        >
          <SidebarContent collapsed={collapsed} transactionCount={transactionCount} />

          {/* Collapse Toggle Button */}
          <div className="absolute -right-3 top-1/2 -translate-y-1/2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
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
          <SheetContent side="left" className="w-72 p-0 bg-sidebar">
            <SidebarContent transactionCount={transactionCount} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
