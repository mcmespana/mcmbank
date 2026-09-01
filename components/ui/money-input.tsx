"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Normaliza texto pegado/escrito de forma arbitraria a dígitos + como mucho
 * una coma decimal. Si hay coma, los puntos se tratan como separador de
 * miles (se eliminan). Si no hay coma pero hay un único punto seguido de 1-2
 * dígitos, se interpreta como decimal (formato inglés) y se convierte a coma;
 * cualquier otro punto se trata como separador de miles.
 */
function normalizeRaw(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "")

  if (s.includes(",")) {
    s = s.replace(/\./g, "")
    const firstComma = s.indexOf(",")
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "")
  } else {
    const dotCount = (s.match(/\./g) || []).length
    if (dotCount === 1) {
      const idx = s.indexOf(".")
      const trailing = s.length - idx - 1
      s = trailing <= 2 ? `${s.slice(0, idx)},${s.slice(idx + 1)}` : s.replace(/\./g, "")
    } else if (dotCount > 1) {
      s = s.replace(/\./g, "")
    }
  }

  return s
}

/** Aplica separador de miles y limita los decimales a 2 dígitos. */
function formatDisplay(normalized: string): string {
  const [intRaw, decRaw] = normalized.split(",")
  const intPart = (intRaw ?? "").replace(/^0+(?=\d)/, "")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  if (decRaw === undefined) return grouped
  return `${grouped},${decRaw.slice(0, 2)}`
}

function countDigits(s: string, upTo: number): number {
  let n = 0
  for (let i = 0; i < upTo && i < s.length; i++) {
    if (/\d/.test(s[i])) n++
  }
  return n
}

function positionAfterDigits(s: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let n = 0
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i])) {
      n++
      if (n === digitCount) return i + 1
    }
  }
  return s.length
}

/** "1.234,56" / "1234.56" / "1234,5" / "" -> number | null */
export function parseMoney(raw: string): number | null {
  const normalized = normalizeRaw(raw)
  if (!normalized) return null
  const s = normalized.replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ""
  return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor formateado en texto, p.ej. "3.048,22". Controlado por el padre. */
  value: string
  onValueChange: (display: string) => void
}

/**
 * Input de importe con formato en vivo estilo español: separador de miles
 * "." y decimales con ",". Pegar "3.048,22", "3048.22" o "3048,22" produce
 * siempre el mismo resultado formateado, y el punto de miles se añade
 * automáticamente mientras se escribe.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, onBlur, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const rawBefore = el.value
      const cursor = el.selectionStart ?? rawBefore.length
      const digitsBeforeCursor = countDigits(rawBefore, cursor)

      const normalized = normalizeRaw(rawBefore)
      const formatted = formatDisplay(normalized)

      onValueChange(formatted)

      requestAnimationFrame(() => {
        const pos = positionAfterDigits(formatted, digitsBeforeCursor)
        el.setSelectionRange(pos, pos)
      })
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const normalized = normalizeRaw(e.target.value)
      if (normalized) {
        const [intRaw, decRaw] = normalized.split(",")
        const intPart = (intRaw ?? "0").replace(/^0+(?=\d)/, "") || "0"
        const decPart = (decRaw ?? "").padEnd(2, "0").slice(0, 2)
        const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        onValueChange(`${grouped},${decPart}`)
      }
      onBlur?.(e)
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "flex h-11 w-full rounded-md border-2 border-input bg-card/60 backdrop-blur-md px-4 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-[color,border-color,box-shadow] duration-200 shadow-sm focus-visible:shadow-md tabular-nums",
          className
        )}
        {...props}
      />
    )
  }
)
MoneyInput.displayName = "MoneyInput"
