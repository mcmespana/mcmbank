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
        "inline-flex items-center gap-1 rounded-full border font-medium",
        info.bgClass,
        info.textClass,
        info.borderClass,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      <span aria-hidden>{info.emoji}</span>
      <span>{short ? info.shortLabel : info.label}</span>
    </span>
  )
}
