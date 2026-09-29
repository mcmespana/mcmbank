"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinanciadores } from "@/hooks/use-subvenciones"
import { crearFinanciador } from "@/lib/services/subvenciones"
import { FINANCIADOR_AMBITOS, FINANCIADOR_AMBITO_INFO } from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import { cn } from "@/lib/utils"
import type { Financiador, FinanciadorAmbito } from "@/lib/types/database"

interface FinanciadorSelectorProps {
  id?: string
  value: string | null
  onChange: (financiador: Financiador | null) => void
  /** Aspecto de texto pulsable, para la edición inline de la ficha. */
  compacto?: boolean
}

/**
 * Elegir quién convoca, o darlo de alta en el mismo gesto. El financiador se
 * repite todos los años, así que lo normal es elegirlo; crear uno nuevo pide
 * además su ámbito, que es lo que decide en qué grupo de la lista aparece.
 */
export function FinanciadorSelector({ id, value, onChange, compacto = false }: FinanciadorSelectorProps) {
  const { financiadores, loading } = useFinanciadores()
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [nuevo, setNuevo] = useState<{ nombre: string; ambito: FinanciadorAmbito } | null>(null)
  const [creando, setCreando] = useState(false)

  const actual = financiadores.find((f) => f.id === value) ?? null
  const porAmbito = useMemo(
    () =>
      FINANCIADOR_AMBITOS.map((a) => ({ a, lista: financiadores.filter((f) => f.ambito === a) })).filter(
        (g) => g.lista.length > 0,
      ),
    [financiadores],
  )
  const existeExacto = financiadores.some((f) => f.nombre.toLowerCase() === busqueda.trim().toLowerCase())

  const crear = async () => {
    if (!nuevo?.nombre.trim()) return
    setCreando(true)
    try {
      const f = await crearFinanciador(nuevo)
      onChange(f)
      setNuevo(null)
      toast.success(`Financiador «${f.nombre}» creado`)
    } catch (err) {
      toast.error(describirError(err, "No se ha podido crear el financiador"))
    } finally {
      setCreando(false)
    }
  }

  if (nuevo) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-2">
        <p className="text-xs text-muted-foreground">
          Nuevo financiador: <span className="font-medium text-foreground">{nuevo.nombre}</span>. ¿De qué ámbito es?
        </p>
        <div className="flex min-w-0 gap-2">
          <Select value={nuevo.ambito} onValueChange={(v) => setNuevo({ ...nuevo, ambito: v as FinanciadorAmbito })}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Ámbito del financiador">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[80]">
              {FINANCIADOR_AMBITOS.map((a) => (
                <SelectItem key={a} value={a}>
                  {FINANCIADOR_AMBITO_INFO[a].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={crear} disabled={creando} aria-busy={creando}>
            {creando && <LoadingSpinner size="sm" />}
            Crear
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNuevo(null)} disabled={creando}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {compacto ? (
          <button
            id={id}
            type="button"
            aria-label={`Financiador: ${actual?.nombre ?? "sin elegir"}. Cambiar`}
            className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("truncate", !actual && "text-muted-foreground")}>
              {actual ? actual.nombre : loading ? "Cargando…" : "Elige quién convoca"}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        ) : (
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !actual && "text-muted-foreground")}>
              {actual ? actual.nombre : loading ? "Cargando…" : "Elige quién convoca"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar o escribir uno nuevo…" value={busqueda} onValueChange={setBusqueda} />
          <CommandList>
            <CommandEmpty>Ninguno se llama así.</CommandEmpty>
            {porAmbito.map(({ a, lista }) => (
              <CommandGroup key={a} heading={FINANCIADOR_AMBITO_INFO[a].label}>
                {lista.map((f) => (
                  <CommandItem
                    key={f.id}
                    value={f.nombre}
                    onSelect={() => {
                      onChange(f)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("h-4 w-4", f.id === value ? "opacity-100" : "opacity-0")} />
                    {f.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {busqueda.trim() && !existeExacto && (
              <CommandGroup>
                <CommandItem
                  value={`__crear__${busqueda}`}
                  onSelect={() => {
                    setNuevo({ nombre: busqueda.trim(), ambito: "otro" })
                    setOpen(false)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Crear «{busqueda.trim()}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
