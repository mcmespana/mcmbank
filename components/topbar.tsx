"use client"
import { DelegationSelector } from "./delegation-selector"
import { Sidebar } from "./sidebar"

interface TopbarProps {
  selectedDelegation?: string | null
  onDelegationChange?: (delegationId: string) => void
  showDelegationSelector?: boolean
}

export function Topbar({ selectedDelegation, onDelegationChange, showDelegationSelector = true }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button */}
      <Sidebar showDesktop={false} />

      {/* Delegation selector */}
      {showDelegationSelector && (
        <div className="flex items-center gap-4">
          <DelegationSelector value={selectedDelegation} onValueChange={onDelegationChange} />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Future: User menu, notifications, etc. */}
    </header>
  )
}
