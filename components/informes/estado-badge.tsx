"use client"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ESTADO_ORDER, ESTADOS, getEstadoConfig, type InformeEstado } from "@/lib/types/informes"
import { Check, ChevronDown } from "lucide-react"

interface EstadoBadgeProps {
  estado: string
  className?: string
  /** Si se pasa, el badge es interactivo y permite cambiar el estado. */
  onChange?: (estado: InformeEstado) => void
  disabled?: boolean
}

export function EstadoBadge({ estado, className, onChange, disabled }: EstadoBadgeProps) {
  const config = getEstadoConfig(estado)

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.badgeClass,
        onChange && !disabled && "cursor-pointer hover:opacity-90",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      {config.label}
      {onChange && !disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
    </span>
  )

  if (!onChange || disabled) return badge

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Cambiar estado">
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {ESTADO_ORDER.map((value) => {
          const c = ESTADOS[value]
          const isActive = value === estado
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60",
                isActive && "bg-muted/40",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", c.dotClass)} />
                {c.label}
              </span>
              {isActive && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
