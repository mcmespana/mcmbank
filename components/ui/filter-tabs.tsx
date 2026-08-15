"use client"

import { useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface FilterTabItem {
  value: string
  label: string
  count?: number
  dotClass?: string
  /** Icono a la izquierda. Manda sobre `dotClass`: dibujar los dos es ruido. */
  icon?: LucideIcon
}

interface FilterTabsProps {
  value: string
  onValueChange: (value: string) => void
  items: FilterTabItem[]
  className?: string
}

/**
 * Pestañas de filtro con scroll horizontal y etiqueta completa en móvil.
 * Sustituye los `TabsList grid-cols-4` que en pantallas estrechas dejaban
 * sólo un punto de color y letras sueltas.
 */
export function FilterTabs({ value, onValueChange, items, className }: FilterTabsProps) {
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    triggerRefs.current.get(value)?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [value])

  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <div className="relative">
        <TabsList
          className={cn(
            "flex w-full items-center justify-start gap-1.5 overflow-x-auto",
            "snap-x snap-mandatory scroll-px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:inline-flex sm:w-fit sm:justify-center sm:mx-auto sm:overflow-visible",
          )}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              ref={(el) => {
                if (el) triggerRefs.current.set(item.value, el)
                else triggerRefs.current.delete(item.value)
              }}
              className="shrink-0 snap-start gap-1.5"
            >
              {item.icon ? (
                <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : item.dotClass ? (
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.dotClass)} aria-hidden />
              ) : null}
              <span>{item.label}</span>
              {Boolean(item.count) && (
                <span className="min-w-[1.25rem] rounded-full bg-primary/10 px-1.5 py-0.5 text-center text-xs font-medium tabular-nums text-primary">
                  {item.count! > 99 ? "99+" : item.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent sm:hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent sm:hidden" aria-hidden />
      </div>
    </Tabs>
  )
}
