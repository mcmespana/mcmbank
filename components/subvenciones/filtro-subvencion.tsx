"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, TrendingDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useSubvenciones } from "@/hooks/use-subvenciones"
import { SUBVENCION_ESTADO_INFO, paraImputar } from "@/lib/utils/subvenciones"
import { cn } from "@/lib/utils"

const ESPECIALES = [
  { value: "con", label: "Con alguna subvención" },
  { value: "sin", label: "Sin subvención" },
] as const

/**
 * El buscador rápido de la oficina técnica en Movimientos: filtrar por una
 * subvención (o por "con alguna" / "sin ninguna") y, al lado, "solo gastos",
 * que es lo que se mira al buscar qué queda por justificar. Solo se monta para
 * gestores centrales.
 */
export function FiltroSubvencion({
  value,
  onChange,
  soloGastos,
  onSoloGastos,
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  soloGastos: boolean
  onSoloGastos: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const { subvenciones } = useSubvenciones()
  const anio = new Date().getFullYear()
  const lista = useMemo(() => paraImputar(subvenciones, { q, anio, todos: true }), [subvenciones, q, anio])
  const elegida = subvenciones.find((s) => s.id === value)
  const etiqueta = elegida
    ? elegida.codigo
      ? `${elegida.codigo} · ${elegida.nombre}`
      : elegida.nombre
    : (ESPECIALES.find((e) => e.value === value)?.label ?? "Cualquiera")

  const elegir = (v: string | undefined) => {
    onChange(v)
    setOpen(false)
    setQ("")
  }

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Filtrar por subvención: ${etiqueta}`}
            className={cn(
              "flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value && "border-primary/50 bg-primary/5",
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{etiqueta}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder="Buscar subvención…" />
            <CommandList className="max-h-80">
              <CommandEmpty>Ninguna coincide.</CommandEmpty>
              {!q.trim() && (
                <CommandGroup>
                  <CommandItem value="__cualquiera__" onSelect={() => elegir(undefined)}>
                    <Check className={cn("h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                    Cualquiera
                  </CommandItem>
                  {ESPECIALES.map((e) => (
                    <CommandItem key={e.value} value={e.value} onSelect={() => elegir(e.value)}>
                      <Check className={cn("h-4 w-4", value === e.value ? "opacity-100" : "opacity-0")} />
                      {e.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Subvenciones">
                {lista.map((s) => (
                  <CommandItem key={s.id} value={s.id} onSelect={() => elegir(s.id)} className="gap-2">
                    <Check className={cn("h-4 w-4 shrink-0", value === s.id ? "opacity-100" : "opacity-0")} />
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", SUBVENCION_ESTADO_INFO[s.estado].dotClass)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {s.codigo && <span className="mr-1 font-mono text-xs text-muted-foreground">{s.codigo}</span>}
                      {s.nombre}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{s.ejercicio ?? "—"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-pressed={soloGastos}
        aria-label="Ver solo gastos"
        title={soloGastos ? "Viendo solo gastos" : "Ver solo gastos"}
        onClick={() => onSoloGastos(!soloGastos)}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          soloGastos
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <TrendingDown className="h-4 w-4" />
      </button>
    </div>
  )
}
