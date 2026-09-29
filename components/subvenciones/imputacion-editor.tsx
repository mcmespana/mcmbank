"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MoneyInput, formatMoney, parseMoney } from "@/components/ui/money-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  importeDesdePorcentaje,
  porcentajeDe,
  redondear2,
  validarImputacion,
} from "@/lib/utils/subvenciones"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

type Modo = "euros" | "porcentaje"

interface ImputacionEditorProps {
  /** Importe del movimiento, con su signo. */
  importeMovimiento: number
  /** Lo que se imputa ahora a esta subvención, en positivo. */
  imputado: number
  /** Lo máximo que puede llevarse esta subvención (el movimiento menos lo de las demás). */
  libre: number
  /** Nombre del movimiento, para el lector de pantalla. */
  concepto: string
  onGuardar: (importe: number) => Promise<void>
}

/**
 * La cifra imputada de una fila, y al pulsarla, un pequeño editor para
 * cambiarla en euros o en porcentaje del movimiento.
 *
 * Una factura grande se reparte entre subvenciones ("600 € al IVAJ, el resto a
 * la Diputación"), y a veces lo que se sabe es el porcentaje ("el 60 %"). Los
 * dos modos escriben lo mismo —euros a céntimos—, y el otro se enseña debajo
 * para que se vea qué va a quedar. Los botones rápidos cubren lo que se hace
 * casi siempre: todo lo libre, la mitad.
 */
export function ImputacionEditor({ importeMovimiento, imputado, libre, concepto, onGuardar }: ImputacionEditorProps) {
  const total = Math.abs(importeMovimiento)
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<Modo>("euros")
  const [euros, setEuros] = useState(formatMoney(imputado))
  const [pct, setPct] = useState(String(porcentajeDe(imputado, total)).replace(".", ","))
  const [guardando, setGuardando] = useState(false)

  const parcial = imputado < total - 0.005
  const valor =
    modo === "euros"
      ? parseMoney(euros)
      : (() => {
          const n = Number(pct.replace(",", "."))
          return Number.isFinite(n) && pct.trim() ? importeDesdePorcentaje(n, total) : null
        })()
  const error = validarImputacion(valor, libre)

  const abrir = (o: boolean) => {
    if (o) {
      setModo("euros")
      setEuros(formatMoney(imputado))
      setPct(String(porcentajeDe(imputado, total)).replace(".", ","))
    }
    setOpen(o)
  }

  const fijar = (importe: number) => {
    const r = redondear2(importe)
    setEuros(formatMoney(r))
    setPct(String(porcentajeDe(r, total)).replace(".", ","))
  }

  const guardar = async () => {
    if (error || valor == null) return
    if (Math.abs(valor - imputado) < 0.005) {
      setOpen(false)
      return
    }
    setGuardando(true)
    try {
      await onGuardar(valor)
      setOpen(false)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex flex-col items-end rounded-md px-1.5 py-0.5 text-right hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Parte imputada de ${concepto}: ${formatCurrency(imputado)}. Cambiar`}
        >
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <Pencil className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
            {formatCurrency(imputado)}
          </span>
          {parcial && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {porcentajeDe(imputado, total).toLocaleString("es-ES")} % de {formatCurrency(total)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Parte que va a esta subvención</p>
          <p className="text-xs text-muted-foreground">
            Movimiento de {formatCurrency(total)}
            {libre < total - 0.005 && <> · {formatCurrency(libre)} libres (el resto está en otras)</>}
          </p>
        </div>

        <div role="radiogroup" aria-label="Cómo escribirlo" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["euros", "porcentaje"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                modo === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "euros" ? "En euros" : "En porcentaje"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
          className="space-y-2"
        >
          {modo === "euros" ? (
            <div className="relative">
              <MoneyInput
                autoFocus
                value={euros}
                onValueChange={(v) => {
                  setEuros(v)
                  const n = parseMoney(v)
                  if (n != null) setPct(String(porcentajeDe(n, total)).replace(".", ","))
                }}
                className="pr-7 text-right tabular-nums"
                aria-label="Importe imputado en euros"
                aria-invalid={Boolean(error)}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            </div>
          ) : (
            <div className="relative">
              <Input
                autoFocus
                inputMode="decimal"
                value={pct}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, "")
                  setPct(v)
                  const n = Number(v.replace(",", "."))
                  if (Number.isFinite(n) && v) setEuros(formatMoney(importeDesdePorcentaje(n, total)))
                }}
                className="pr-7 text-right tabular-nums"
                aria-label="Porcentaje del movimiento"
                aria-invalid={Boolean(error)}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          )}

          <p className={cn("text-xs tabular-nums", error ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {error ??
              (modo === "euros"
                ? `= ${porcentajeDe(valor ?? 0, total).toLocaleString("es-ES")} % del movimiento`
                : `= ${formatCurrency(valor ?? 0)}`)}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => fijar(libre)}>
              Todo lo libre
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => fijar(Math.min(total / 2, libre))}>
              La mitad
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={Boolean(error) || guardando} aria-busy={guardando}>
              {guardando && <LoadingSpinner size="sm" />}
              Guardar parte
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
