"use client"

import { useState } from "react"
import { CalendarIcon, ChevronDown } from "lucide-react"
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
  { label: "Rango personalizado", value: "custom" },
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "Esta semana", value: "this-week" },
  { label: "Semana pasada", value: "last-week" },
  { label: "Este mes", value: "this-month" },
  { label: "Mes pasado", value: "last-month" },
  { label: "Este trimestre", value: "this-quarter" },
  { label: "Trimestre pasado", value: "last-quarter" },
  { label: "Este año", value: "this-year" },
  { label: "Año pasado", value: "last-year" },
  { label: "Desde el inicio", value: "all-time" },
]

export function DateRangeFilter({ dateFrom, dateTo, onDateRangeChange }: DateRangeFilterProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState("all-time")
  const [tempDateFrom, setTempDateFrom] = useState<string | undefined>(dateFrom)
  const [tempDateTo, setTempDateTo] = useState<string | undefined>(dateTo)

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
      case "this-quarter":
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
        onDateRangeChange(format(startOfDay(quarterStart), "yyyy-MM-dd"), format(endOfDay(today), "yyyy-MM-dd"))
        break
      case "last-quarter":
        const lastQuarterStart = subMonths(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), 3)
        const lastQuarterEnd = subDays(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), 1)
        onDateRangeChange(
          format(startOfDay(lastQuarterStart), "yyyy-MM-dd"),
          format(endOfDay(lastQuarterEnd), "yyyy-MM-dd"),
        )
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
        setTempDateFrom(dateFrom)
        setTempDateTo(dateTo)
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
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[200px] sm:w-[250px]">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fecha inicio</label>
                <Calendar
                  mode="single"
                  selected={tempDateFrom ? new Date(tempDateFrom) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setTempDateFrom(format(date, "yyyy-MM-dd"))
                    }
                  }}
                  locale={es}
                  weekStartsOn={1}
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fecha fin</label>
                <Calendar
                  mode="single"
                  selected={tempDateTo ? new Date(tempDateTo) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setTempDateTo(format(date, "yyyy-MM-dd"))
                    }
                  }}
                  locale={es}
                  weekStartsOn={1}
                  className="rounded-md border"
                  disabled={(date) => tempDateFrom ? date < new Date(tempDateFrom) : false}
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {tempDateFrom && tempDateTo && (
                  <span>
                    {format(new Date(tempDateFrom), "dd MMM yyyy", { locale: es })} - {format(new Date(tempDateTo), "dd MMM yyyy", { locale: es })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setCustomRangeOpen(false)
                    setTempDateFrom(dateFrom)
                    setTempDateTo(dateTo)
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => {
                    onDateRangeChange(tempDateFrom, tempDateTo)
                    setSelectedPreset("custom")
                    setCustomRangeOpen(false)
                  }}
                  disabled={!tempDateFrom || !tempDateTo}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
