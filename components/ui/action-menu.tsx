"use client"

import { useState } from "react"
import type { MouseEvent } from "react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface ActionMenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  align?: "start" | "center" | "end"
  ariaLabel?: string
}

/**
 * Menú de acciones secundarias sobre `Popover` (no existe `dropdown-menu`
 * en el repo). Deja en la fila sólo la acción primaria del estado.
 */
export function ActionMenu({ items, align = "end", ariaLabel = "Más acciones" }: ActionMenuProps) {
  const [open, setOpen] = useState(false)

  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={stop}>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={ariaLabel}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-1" onClick={stop}>
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              setOpen(false)
              item.onSelect()
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none disabled:pointer-events-none disabled:opacity-50",
              item.destructive && "text-destructive hover:text-destructive",
            )}
          >
            {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
