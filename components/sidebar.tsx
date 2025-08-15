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

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    count: null,
    enabled: true,
  },
  {
    name: "Transacciones",
    href: "/transacciones",
    icon: ArrowLeftRight,
    count: 6,
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
    enabled: false,
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
    name: "Alertas",
    href: "/alertas",
    icon: Bell,
    count: 0,
    enabled: false,
  },
  {
    name: "Integraciones",
    href: "/integraciones",
    icon: Zap,
    count: 1,
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

interface SidebarContentProps {
  className?: string
  collapsed?: boolean
}

function SidebarContent({ className, collapsed = false }: SidebarContentProps) {
  const pathname = usePathname()

  return (
    <div className={cn("flex h-full flex-col bg-sidebar", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-sidebar-primary" />
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground">MCM Bank</span>}
        </div>
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
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-72"
      )}>
        <SidebarContent collapsed={collapsed} />
        
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

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
