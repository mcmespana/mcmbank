"use client"

import { BookOpen, LogOut } from "lucide-react"

import { DelegationSelector } from "./delegation-selector"
import { Sidebar } from "./sidebar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

interface TopbarProps {
  selectedDelegation?: string | null
  onDelegationChange?: (delegationId: string) => void
}

export function Topbar({ selectedDelegation, onDelegationChange }: TopbarProps) {
  const { user, signOut } = useAuth()
  const manualUrl =
    process.env.NEXT_PUBLIC_URL_MANUAL ?? process.env.URL_MANUAL ?? "#"

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button */}
      <Sidebar showDesktop={false} />

      {/* Delegation selector */}
      <div className="flex items-center gap-4">
        <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Manual & User section */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <a href={manualUrl} target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-5 w-5" />
            <span className="sr-only">Manual</span>
          </a>
        </Button>
        {user && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Cerrar sesión</span>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
