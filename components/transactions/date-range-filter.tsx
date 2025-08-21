"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface DateRangeFilterProps {
  dateFrom?: string
  dateTo?: string
  onDateRangeChange: (dateFrom?: string, dateTo?: string) => void
}

const DATE_PRESETS = [
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "Esta semana", value: "this-week" },
  { label: "Semana pasada", value: "last-week" },
  { label: "Este mes", value: "this-month" },
  { label: "Mes pasado", value: "last-month" },
  { label: "Este curso escolar", value: "this-school-year" },
  { label: "Curso escolar anterior", value: "last-school-year" },
  { label: "Este año", value: "this-year" },
  { label: "Año pasado", value: "last-year" },
  { label: "Desde el inicio", value: "all-time" },
  { label: "Rango personalizado", value: "custom" },
]

export function DateRangeFilter({ dateFrom, dateTo, onDateRangeChange }: DateRangeFilterProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState("all-time")

  const getSchoolYearDates = (isCurrentYear = true) => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-11

    let schoolYearStart: Date
    let schoolYearEnd: Date

    if (isCurrentYear) {
      // Si estamos antes de septiembre, el curso actual empezó el septiembre anterior
      if (currentMonth < 8) {
        // Antes de septiembre (mes 8)
        schoolYearStart = new Date(currentYear - 1, 8, 1) // 1 septiembre año anterior
        schoolYearEnd = new Date(currentYear, 7, 31) // 31 agosto año actual
      } else {
        schoolYearStart = new Date(currentYear, 8, 1) // 1 septiembre año actual
        schoolYearEnd = new Date(currentYear + 1, 7, 31) // 31 agosto año siguiente
      }
    } else {
      // Curso anterior
      if (currentMonth < 8) {
        schoolYearStart = new Date(currentYear - 2, 8, 1)
        schoolYearEnd = new Date(currentYear - 1, 7, 31)
      } else {
        schoolYearStart = new Date(currentYear - 1, 8, 1)
        schoolYearEnd = new Date(currentYear, 7, 31)
      }
    }

    return { schoolYearStart, schoolYearEnd }
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    const today = new Date()

    switch (preset) {
      case "today":
        onDateRangeChange(format(startOfDay(today), "yyyy-MM-dd"), format(endOfDay(today), "yyyy-MM-dd"))
        break
      case "yesterday":
        const yesterday = subDays(today, 1)
        onDateRangeChange(format(startOfDay(yesterday), "yyyy-MM-dd"), format(endOfDay(yesterday), "yyyy-MM-dd"))
        break
      case "this-week":
        const weekStart = subDays(today, today.getDay())
        onDateRangeChange(format(startOfDay(weekStart), "yyyy-MM-dd"), format(endOfDay(today), "yyyy-MM-dd"))
        break
      case "last-week":
        const lastWeekEnd = subDays(today, today.getDay())
        const lastWeekStart = subDays(lastWeekEnd, 6)
        onDateRangeChange(format(startOfDay(lastWeekStart), "yyyy-MM-dd"), format(endOfDay(lastWeekEnd), "yyyy-MM-dd"))
        break
      case "this-month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        onDateRangeChange(format(startOfDay(monthStart), "yyyy-MM-dd"), format(endOfDay(today), "yyyy-MM-dd"))
        break
      case "last-month":
        const lastMonthStart = subMonths(new Date(today.getFullYear(), today.getMonth(), 1), 1)
        const lastMonthEnd = subDays(new Date(today.getFullYear(), today.getMonth(), 1), 1)
        onDateRangeChange(
          format(startOfDay(lastMonthStart), "yyyy-MM-dd"),
          format(endOfDay(lastMonthEnd), "yyyy-MM-dd"),
        )
        break
      case "this-school-year":
        const { schoolYearStart: currentStart, schoolYearEnd: currentEnd } = getSchoolYearDates(true)
        onDateRangeChange(format(startOfDay(currentStart), "yyyy-MM-dd"), format(endOfDay(currentEnd), "yyyy-MM-dd"))
        break
      case "last-school-year":
        const { schoolYearStart: lastStart, schoolYearEnd: lastEnd } = getSchoolYearDates(false)
        onDateRangeChange(format(startOfDay(lastStart), "yyyy-MM-dd"), format(endOfDay(lastEnd), "yyyy-MM-dd"))
        break
      case "this-year":
        const yearStart = new Date(today.getFullYear(), 0, 1)
        onDateRangeChange(format(startOfDay(yearStart), "yyyy-MM-dd"), format(endOfDay(today), "yyyy-MM-dd"))
        break
      case "last-year":
        const lastYearStart = subYears(new Date(today.getFullYear(), 0, 1), 1)
        const lastYearEnd = subDays(new Date(today.getFullYear(), 0, 1), 1)
        onDateRangeChange(format(startOfDay(lastYearStart), "yyyy-MM-dd"), format(endOfDay(lastYearEnd), "yyyy-MM-dd"))
        break
      case "all-time":
        onDateRangeChange(undefined, undefined)
        break
      case "custom":
        setCustomRangeOpen(true)
        break
    }
  }

  const getDisplayValue = () => {
    if (selectedPreset === "custom" && (dateFrom || dateTo)) {
      if (dateFrom && dateTo) {
        return `${format(new Date(dateFrom), "dd/MM/yyyy", { locale: es })} - ${format(new Date(dateTo), "dd/MM/yyyy", { locale: es })}`
      }
      if (dateFrom) {
        return `Desde ${format(new Date(dateFrom), "dd/MM/yyyy", { locale: es })}`
      }
      if (dateTo) {
        return `Hasta ${format(new Date(dateTo), "dd/MM/yyyy", { locale: es })}`
      }
    }
    return DATE_PRESETS.find((p) => p.value === selectedPreset)?.label || "Desde el inicio"
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full min-w-[160px] h-12">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom Range Popover */}
      <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
        <PopoverTrigger asChild>
          <div />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            <div className="text-sm font-medium">Rango personalizado</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Desde</label>
                <Calendar
                  mode="single"
                  selected={dateFrom ? new Date(dateFrom) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange(format(date, "yyyy-MM-dd"), dateTo)
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hasta</label>
                <Calendar
                  mode="single"
                  selected={dateTo ? new Date(dateTo) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange(dateFrom, format(date, "yyyy-MM-dd"))
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCustomRangeOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => setCustomRangeOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
