"use client"

import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { FacturaEstado } from "@/lib/types/database"

interface FacturaImporteProps {
  importe: number
  estado?: FacturaEstado | null
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * El importe de una factura, coloreado por lo que se ha pagado de ella.
 *
 * `AmountDisplay` colorea por el signo, que es lo correcto para un movimiento:
 * verde entra, rojo sale. Pero el importe de una factura se guarda **siempre en
 * positivo** (es lo que hay que pagar, no un apunte con signo), así que allí
 * salía verde — y una factura recién llegada, sin pagar y sin conciliar, se
 * leía de un vistazo como cobrada. Aquí el color lo pone el estado, que es lo
 * que de verdad se está preguntando al mirar el número.
 */
const TONO: Record<FacturaEstado, string> = {
  bandeja: "bg-muted/60 text-foreground",
  sin_pagar: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  pagada_parcial: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  pagada: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  pagada_fuera: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
}

const TAMANOS = {
  sm: "text-sm px-2 py-0.5",
  md: "text-base px-3 py-1",
  lg: "text-lg px-4 py-1.5",
} as const

export function FacturaImporte({ importe, estado, size = "md", className }: FacturaImporteProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tabular-nums",
        estado ? TONO[estado] : "bg-muted/60 text-foreground",
        TAMANOS[size],
        className,
      )}
    >
      {formatCurrency(Math.abs(importe))}
    </div>
  )
}
