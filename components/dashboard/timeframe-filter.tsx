"use client"

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
}

export function TimeframeFilter({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
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
