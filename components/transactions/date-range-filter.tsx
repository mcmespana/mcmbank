"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { type DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"

interface DateRangeFilterProps {
  dateFrom?: string
  dateTo?: string
  onDateRangeChange: (dateFrom?: string, dateTo?: string) => void
  /** Preset con el que arranca. Por defecto "desde el inicio"; la pantalla de
   *  saldos por proveedor arranca en el curso actual, que es lo que se mira. */
  defaultPreset?: string
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

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateRangeChange,
  defaultPreset = "all-time",
}: DateRangeFilterProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset)
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  }))

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
        setRange({
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined,
        })
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
    <div className="flex flex-wrap items-center gap-2 w-full">
      <CalendarIcon className="hidden sm:block h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-9 sm:h-10 w-full min-w-[160px] flex-1">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-none">
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom Range Dialog */}
      <Dialog open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
        <DialogContent className="p-0 w-[90vw] max-w-md">
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="self-start text-sm font-medium">Rango personalizado</div>
            <Calendar
              mode="range"
              defaultMonth={range?.from}
              selected={range}
              onSelect={setRange}
              locale={es}
              className="mx-auto rounded-lg border shadow-sm"
            />
            <p className="text-center text-[0.6rem] text-muted-foreground">
              Haz click primero en la fecha de inicio y después en la de fin. Para volver a empezar, dos clicks seguidos en una fecha
            </p>
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCustomRangeOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onDateRangeChange(
                    range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
                    range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
                  )
                  setCustomRangeOpen(false)
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
