"use client"

import { useEffect, useRef, useState } from "react"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatIsoDateToInput, maskDateInput, parseDateInputToIso } from "@/lib/utils/date-input"

interface DateFieldProps {
  /** Fecha en ISO "yyyy-mm-dd" (o null/"" si vacía). */
  value: string | null
  /** Se llama con la nueva fecha ISO "yyyy-mm-dd" cuando es válida. */
  onChange: (isoDate: string) => void
  id?: string
  className?: string
  /**
   * Alto del campo. "sm" (h-9) es el de los formularios compactos de
   * Movimientos; "md" es el alto de fábrica de `Input` (h-11), que es lo que
   * hay que usar cuando el campo comparte fila con otro `Input` normal —si no,
   * la fecha queda visiblemente más baja que el importe de al lado.
   */
  size?: "sm" | "md"
}

/**
 * Campo de fecha con entrada de texto enmascarada (DD/MM/AAAA) y calendario.
 * - El calendario se abre en el mes de la fecha seleccionada (no en hoy).
 * - Incluye botón "Hoy".
 * - Al escribir en medio del campo el cursor no salta al final.
 */
export function DateField({ value, onChange, id, className, size = "sm" }: DateFieldProps) {
  const alto = size === "md" ? "h-11" : "h-9"
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => formatIsoDateToInput(value))
  const inputRef = useRef<HTMLInputElement>(null)
  // nº de dígitos antes del cursor, para restaurar el caret tras enmascarar
  const caretDigitsRef = useRef<number | null>(null)

  // Mantener el texto en sync cuando cambia el value desde fuera
  useEffect(() => {
    setText(formatIsoDateToInput(value))
  }, [value])

  // Restaurar la posición del cursor después de reformatear
  useEffect(() => {
    if (caretDigitsRef.current === null || !inputRef.current) return
    const targetDigits = caretDigitsRef.current
    caretDigitsRef.current = null
    let pos = 0
    let seen = 0
    for (const ch of text) {
      if (seen >= targetDigits) break
      if (/\d/.test(ch)) seen++
      pos++
    }
    inputRef.current.setSelectionRange(pos, pos)
  }, [text])

  const selectedDate = value ? new Date(value) : undefined

  const commit = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    onChange(`${y}-${m}-${d}`)
  }

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        className={`flex-1 min-w-0 ${alto}`}
        value={text}
        onChange={(e) => {
          const el = e.target
          const rawLeft = el.value.slice(0, el.selectionStart ?? el.value.length)
          caretDigitsRef.current = rawLeft.replace(/\D/g, "").length
          const masked = maskDateInput(el.value)
          setText(masked)
          const iso = parseDateInputToIso(masked)
          if (iso) onChange(iso)
        }}
        onBlur={() => setText(formatIsoDateToInput(value))}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`${alto} w-9 flex-shrink-0 ${size === "md" ? "rounded-xl border-2" : ""}`}
            title="Abrir calendario"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[80]" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            // Abre el calendario en el mes de la transacción, no en hoy
            defaultMonth={selectedDate ?? new Date()}
            onSelect={(date) => {
              if (date) {
                commit(date)
                setOpen(false)
              }
            }}
            locale={es}
            autoFocus
          />
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                commit(new Date())
                setOpen(false)
              }}
            >
              Hoy
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
