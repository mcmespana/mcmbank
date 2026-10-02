"use client"

import { useState } from "react"
import { Check, Palette } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  COLORES_SUBVENCION,
  colorPorReglas,
  esColorSubvencion,
  type ColorSubvencion,
} from "@/lib/utils/subvenciones"
import { cn } from "@/lib/utils"

/**
 * Elegir el color del código de una subvención. "Automático" lo devuelve a las
 * reglas de `colorPorReglas()` (GVA rojo, IVAJ negro…), que es lo normal: a
 * mano solo se elige cuando una subvención no encaja en ellas.
 */
export function ColorSubvencionPicker({
  codigo,
  nombre,
  color,
  onGuardar,
  enCapa = false,
}: {
  codigo: string | null
  nombre: string
  color: string | null
  onGuardar: (color: ColorSubvencion | null) => Promise<void>
  enCapa?: boolean
}) {
  const [open, setOpen] = useState(false)
  const elegido = esColorSubvencion(color) ? color : null
  const automatico = colorPorReglas(codigo, nombre)
  const actual = elegido ?? automatico

  const elegir = (c: ColorSubvencion | null) => {
    setOpen(false)
    if (c === elegido) return
    onGuardar(c).catch(() => undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Color del código: ${COLORES_SUBVENCION[actual].label}${elegido ? "" : " (automático)"}. Cambiar`}
          title="Cambiar el color del código"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-64 p-3", enCapa && "z-[80]")}>
        <p className="mb-2 text-xs font-medium">Color del código</p>
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Color del código">
          {(Object.keys(COLORES_SUBVENCION) as ColorSubvencion[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={elegido === c}
              aria-label={COLORES_SUBVENCION[c].label}
              title={COLORES_SUBVENCION[c].label}
              onClick={() => elegir(c)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                COLORES_SUBVENCION[c].muestra,
                elegido === c && "ring-2 ring-foreground",
              )}
            >
              {elegido === c && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" aria-hidden />}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="radio"
          aria-checked={!elegido}
          onClick={() => elegir(null)}
          className={cn(
            "mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
            !elegido && "bg-muted font-medium",
          )}
        >
          <span className={cn("h-3 w-3 shrink-0 rounded-full", COLORES_SUBVENCION[automatico].muestra)} aria-hidden />
          <span className="min-w-0 flex-1">
            Automático <span className="text-muted-foreground">· {COLORES_SUBVENCION[automatico].label.toLowerCase()} por el código</span>
          </span>
          {!elegido && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        </button>
      </PopoverContent>
    </Popover>
  )
}
