"use client"

import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ListRowProps {
  accentClass?: string
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  selected?: boolean
  className?: string
  children: ReactNode
}

/**
 * Fila densa de una columna, con la densidad de Movimientos
 * (ver components/transactions/transaction-list-row.tsx). `accentClass`
 * pinta una banda de estado a la izquierda; nunca usar el `absolute w-[3px]`
 * de las tarjetas antiguas.
 */
export function ListRow({ accentClass, onClick, selected, className, children }: ListRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(e as unknown as MouseEvent<HTMLDivElement>)
    }
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "bg-card rounded-lg border border-border/50 p-3 shadow-sm transition-[background-color,border-color,box-shadow] duration-150",
        onClick && "cursor-pointer hover:bg-muted/50 hover:border-border hover:shadow-md",
        accentClass && "border-l-4",
        accentClass,
        selected && "border-primary/60 bg-primary/5 ring-1 ring-primary/40 hover:bg-primary/10",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface ListHeaderRowProps {
  className?: string
  children: ReactNode
}

/** Cabecera de columnas alineada con `ListRow`, oculta por debajo de `lg`. */
export function ListHeaderRow({ className, children }: ListHeaderRowProps) {
  return (
    <div
      className={cn(
        "hidden px-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground lg:grid",
        className,
      )}
    >
      {children}
    </div>
  )
}
