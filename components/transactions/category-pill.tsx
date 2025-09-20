"use client"

import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria } from "@/lib/types/database"

interface CategoryPillProps {
  category: Categoria
  size?: "xs" | "sm" | "md" | "lg"
  isSelected?: boolean
  onClick?: () => void
  className?: string
  prefix?: ReactNode
  suffix?: ReactNode
}

export function CategoryPill({
  category,
  size = "md",
  isSelected = false,
  onClick,
  className,
  prefix,
  suffix,
}: CategoryPillProps) {
  const { color, textColor, rgbValue } = getCategoryColorTokens(category)

  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  const baseClasses = cn(
    "inline-flex items-center gap-2 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "bg-[rgba(var(--category-color-rgb),0.1)] text-slate-900 dark:text-slate-100 dark:bg-[rgba(var(--category-color-rgb),0.28)]",
    category.categoria_padre_id
      ? "border-[rgba(var(--category-color-rgb),0.25)] text-[color:var(--category-color)] hover:bg-[rgba(var(--category-color-rgb),0.18)] dark:border-[rgba(var(--category-color-rgb),0.35)] dark:text-[color:var(--category-color)] dark:hover:bg-[rgba(var(--category-color-rgb),0.36)]"
      : "border-[rgba(var(--category-color-rgb),0.35)] hover:bg-[rgba(var(--category-color-rgb),0.16)] dark:border-[rgba(var(--category-color-rgb),0.45)] dark:hover:bg-[rgba(var(--category-color-rgb),0.32)]",
    isSelected &&
      "ring-2 ring-offset-2 ring-[color:var(--category-color)] ring-offset-background border-[rgba(var(--category-color-rgb),0.45)] bg-[rgba(var(--category-color-rgb),0.2)] dark:bg-[rgba(var(--category-color-rgb),0.4)]",
    {
      lg: "text-sm px-4 py-2.5",
      md: "text-sm px-3.5 py-2",
      sm: "text-xs px-3 py-1.5",
      xs: "text-xs px-2.5 py-1",
    }[size],
    onClick ? "cursor-pointer" : "cursor-default",
    className,
  )

  const content = (
    <>
      {prefix}
      {category.emoji && (
        <span
          className={cn(
            "leading-none",
            size === "xs" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg",
          )}
        >
          {category.emoji}
        </span>
      )}
      <span className="font-medium leading-none truncate">{category.nombre}</span>
      {suffix}
    </>
  )

  if (onClick) {
    return (
      <button type="button" style={style} onClick={onClick} className={baseClasses}>
        {content}
      </button>
    )
  }

  return (
    <span style={style} className={baseClasses}>
      {content}
    </span>
  )
}
