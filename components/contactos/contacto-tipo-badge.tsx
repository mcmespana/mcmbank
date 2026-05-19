"use client"

import { cn } from "@/lib/utils"
import { getContactoTipoInfo } from "@/lib/utils/contacto-tipos"
import type { ContactoTipo } from "@/lib/types/database"

interface ContactoTipoBadgeProps {
  tipo: ContactoTipo
  size?: "sm" | "md"
  short?: boolean
  className?: string
}

export function ContactoTipoBadge({ tipo, size = "md", short = false, className }: ContactoTipoBadgeProps) {
  const info = getContactoTipoInfo(tipo)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight",
        info.bgClass,
        info.textClass,
        info.borderClass,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", info.dotClass)} aria-hidden />
      <span>{short ? info.shortLabel : info.label}</span>
    </span>
  )
}
