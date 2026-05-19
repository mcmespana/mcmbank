"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusPillProps {
  label: string
  /** Dot de color (tailwind utility) p.ej. "bg-emerald-500". */
  dotClass?: string
  /** Tinte de fondo sutil. */
  bgClass?: string
  textClass?: string
  borderClass?: string
  icon?: LucideIcon
  size?: "sm" | "md"
  className?: string
}

/**
 * Pill sobrio estilo Linear/Vercel: dot de color + texto, sin emojis.
 * Cuando se pasa `icon`, lo pinta antes del label en lugar del dot.
 */
export function StatusPill({
  label,
  dotClass,
  bgClass,
  textClass,
  borderClass,
  icon: Icon,
  size = "sm",
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight whitespace-nowrap",
        bgClass,
        textClass,
        borderClass,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      {Icon ? (
        <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      ) : dotClass ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />
      ) : null}
      <span>{label}</span>
    </span>
  )
}
