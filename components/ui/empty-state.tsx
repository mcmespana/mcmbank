"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  className?: string
  children?: ReactNode
}

export function EmptyState({ title, description, icon, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/20 bg-white/70 p-10 text-center shadow-[0_18px_55px_-30px_rgba(37,99,235,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/60 text-muted-foreground shadow-inner dark:border-white/10 dark:bg-white/10">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-foreground dark:text-white">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )}

