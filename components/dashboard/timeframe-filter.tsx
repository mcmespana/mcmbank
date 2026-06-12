"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toLocalDateString } from "@/lib/utils/format"

export type Timeframe =
  | "today"
  | "week"
  | "month"
  | "last-month"
  | "year"
  | "last-year"
  | "school-year"
  | "last-school-year"

const OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "last-month", label: "Mes pasado" },
  { value: "year", label: "Este año" },
  { value: "last-year", label: "Año pasado" },
  { value: "school-year", label: "Este curso escolar" },
  { value: "last-school-year", label: "Curso pasado" },
] as const

interface Props {
  value: Timeframe
  onChange: (value: Timeframe) => void
}

export function TimeframeFilter({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[200px]">
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
  let to = new Date(now)

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
    case "last-month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case "year":
      from = new Date(now.getFullYear(), 0, 1)
      break
    case "last-year":
      from = new Date(now.getFullYear() - 1, 0, 1)
      to = new Date(now.getFullYear() - 1, 11, 31)
      break
    case "school-year":
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
      from = new Date(startYear, 8, 1)
      break
    case "last-school-year":
      const lastStartYear = now.getMonth() >= 8 ? now.getFullYear() - 1 : now.getFullYear() - 2
      from = new Date(lastStartYear, 8, 1)
      to = new Date(lastStartYear + 1, 7, 31)
      break
  }
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(to),
  }
}
