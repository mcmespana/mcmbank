"use client"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type Timeframe = "today" | "week" | "month" | "school-year"

const OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "school-year", label: "Este curso escolar" },
] as const

interface Props {
  value: Timeframe
  onChange: (value: Timeframe) => void
  className?: string
}

export function TimeframeFilter({ value, onChange, className }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "min-w-[200px] rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/20",
          className,
        )}
      >
        <SelectValue placeholder="Seleccionar periodo" />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border border-white/10 bg-slate-950/95 text-slate-100 shadow-xl">
        {OPTIONS.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="rounded-lg px-3 py-2 text-sm font-medium data-[state=checked]:bg-primary/20 data-[state=checked]:text-white"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function getTimeframeRange(timeframe: Timeframe) {
  const now = new Date()
  let from = new Date(now)
  switch (timeframe) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "week":
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1
      from.setDate(now.getDate() - day)
      break
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case "school-year":
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
      from = new Date(startYear, 8, 1)
      break
  }
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  }
}
