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
  /**
   * Texto de confirmación para las acciones sin vuelta atrás: el primer toque
   * cambia la etiqueta a esto y solo el segundo ejecuta. Mismo trato que
   * `ConfirmButton`, pero sin sacar un diálogo encima del panel.
   */
  confirmLabel?: string
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  ariaLabel?: string
  /** Clases del panel. Sirve sobre todo para subir el z-index cuando el menú
   *  se abre desde un diálogo o un panel, que ya van por encima del z-50 base. */
  contentClassName?: string
}

/**
 * Menú de acciones secundarias sobre `Popover` (no existe `dropdown-menu`
 * en el repo). Deja en la fila sólo la acción primaria del estado.
 */
export function ActionMenu({
  items,
  align = "end",
  side,
  ariaLabel = "Más acciones",
  contentClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [armado, setArmado] = useState<number | null>(null)

  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setArmado(null)
      }}
    >
      <PopoverTrigger asChild onClick={stop}>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={ariaLabel}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        collisionPadding={12}
        className={cn("w-56 max-w-[calc(100vw-1.5rem)] p-1", contentClassName)}
        onClick={stop}
      >
        {items.map((item, i) => {
          const pidiendoConfirmacion = armado === i
          return (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.confirmLabel && !pidiendoConfirmacion) {
                  setArmado(i)
                  return
                }
                setOpen(false)
                setArmado(null)
                item.onSelect()
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                (item.destructive || pidiendoConfirmacion) && "text-destructive hover:text-destructive",
                pidiendoConfirmacion && "bg-destructive/10 font-medium",
              )}
            >
              {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{pidiendoConfirmacion ? item.confirmLabel : item.label}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
