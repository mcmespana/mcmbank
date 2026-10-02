"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowUpRight, Check, Landmark, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useAuth } from "@/contexts/auth-context"
import { subvencionesKey, useSubvenciones } from "@/hooks/use-subvenciones"
import { imputarMovimientos, quitarMovimientos, subvencionesDeMovimiento } from "@/lib/services/subvenciones"
import { SUBVENCION_ESTADO_INFO, paraImputar, porcentajeDe, redondear2 } from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

/**
 * "Imputado a una subvención", en el detalle de un movimiento, con la parte de
 * cada una si está repartido, y el atajo para imputarlo: un botón, una
 * subvención, hecho. Entra por todo lo que le quede libre (el 100 % si no está
 * en ninguna otra); la parte se ajusta luego en la subvención.
 *
 * Solo para gestores centrales (a los demás la RLS les devolvería siempre
 * vacío). Es la respuesta a "¿este gasto ya lo he usado?" sin salir de
 * Movimientos.
 */
export function SubvencionDeMovimiento({
  movimientoId,
  importe,
}: {
  movimientoId: string | null | undefined
  importe?: number | null
}) {
  const qc = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: [...subvencionesKey, "de-movimiento", movimientoId],
    queryFn: () => subvencionesDeMovimiento(movimientoId as string),
    enabled: Boolean(movimientoId),
  })

  if (!movimientoId || isPending) return null
  const lista = data ?? []
  const total = Math.abs(importe ?? 0)
  const imputado = lista.reduce((a, s) => a + s.importe_imputado, 0)
  const libre = redondear2(Math.max(total - imputado, 0))
  const refrescar = () => qc.invalidateQueries({ queryKey: subvencionesKey })

  if (lista.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Landmark className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">Sin subvención</span>
        <ImputarRapido movimientoId={movimientoId} libre={libre} yaEn={[]} onHecho={refrescar} />
      </div>
    )
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Landmark className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          {lista.length === 1 ? "Imputado a una subvención" : `Repartido entre ${lista.length} subvenciones`}
          {total > 0 && libre > 0.005 && (
            <span className="font-normal text-muted-foreground"> · {formatCurrency(libre)} libres</span>
          )}
        </span>
        {libre > 0.005 && (
          <ImputarRapido
            movimientoId={movimientoId}
            libre={libre}
            yaEn={lista.map((s) => s.id)}
            onHecho={refrescar}
            compacto
          />
        )}
      </div>
      <ul className="space-y-1">
        {lista.map((s) => (
          <li key={s.id}>
            <Link
              href={`/subvenciones/${s.id}`}
              className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate">
                {s.codigo && <span className="mr-1 font-mono text-muted-foreground">{s.codigo}</span>}
                {s.nombre}
                {s.financiador && <span className="text-muted-foreground"> · {s.financiador}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCurrency(s.importe_imputado)}
                {total > 0 && s.importe_imputado < total - 0.005 && (
                  <span className="text-muted-foreground"> ({porcentajeDe(s.importe_imputado, total).toLocaleString("es-ES")} %)</span>
                )}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * El buscador del atajo. Sin escribir enseña las del año en curso (que es
 * donde se imputa casi siempre) y "Otros años" las abre todas; escribiendo
 * busca en todos.
 */
function ImputarRapido({
  movimientoId,
  libre,
  yaEn,
  onHecho,
  compacto = false,
}: {
  movimientoId: string
  libre: number
  yaEn: string[]
  onHecho: () => void
  compacto?: boolean
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [todosLosAnios, setTodosLosAnios] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const { subvenciones, loading } = useSubvenciones({ enabled: open })

  const anio = new Date().getFullYear()
  const delAnio = useMemo(() => paraImputar(subvenciones, { anio }), [subvenciones, anio])
  // Si en el año en curso no hay ninguna, se enseñan todas sin pedirlo.
  const todos = todosLosAnios || delAnio.length === 0
  const visibles = useMemo(
    () => (q.trim() || todos ? paraImputar(subvenciones, { q, anio, todos: true }) : delAnio),
    [subvenciones, q, todos, delAnio, anio],
  )
  const mostrarOtros = !q.trim() && !todos && paraImputar(subvenciones, { todos: true }).length > delAnio.length

  const imputar = async (destinoId: string, nombre: string) => {
    setOpen(false)
    setGuardando(true)
    try {
      await imputarMovimientos(destinoId, [{ id: movimientoId, importe: libre }], user?.id ?? null)
      onHecho()
      toast.success(`Imputado a ${nombre} · ${formatCurrency(libre)}`, {
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: () => {
            quitarMovimientos(destinoId, [movimientoId])
              .then(onHecho)
              .catch((err) => toast.error(describirError(err, "No se ha podido deshacer")))
          },
        },
      })
    } catch (err) {
      toast.error(describirError(err, "No se ha podido imputar el movimiento"))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setQ("")
          setTodosLosAnios(false)
        }
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={compacto ? "ghost" : "outline"}
          size="sm"
          className={cn("h-7 shrink-0 text-xs", compacto && "px-2")}
          disabled={guardando}
          aria-busy={guardando}
        >
          {guardando ? <LoadingSpinner size="sm" /> : <Plus className="h-3.5 w-3.5" />}
          {compacto ? "Otra" : "Imputar a subvención"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[80] w-[22rem] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Buscar código, nombre, financiador…" />
          <CommandList className="max-h-80">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <LoadingSpinner size="sm" /> Cargando…
              </div>
            ) : (
              <>
                <CommandEmpty>Ninguna coincide.</CommandEmpty>
                <CommandGroup heading={q.trim() || todos ? "Todos los años" : `${anio}`}>
                  {visibles.map((s) => {
                    const info = SUBVENCION_ESTADO_INFO[s.estado]
                    const ya = yaEn.includes(s.id)
                    return (
                      <CommandItem
                        key={s.id}
                        value={s.id}
                        disabled={ya}
                        onSelect={() => imputar(s.id, s.codigo || s.nombre)}
                        className="gap-2"
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", info.dotClass)} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {s.codigo && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{s.codigo}</span>}
                            {s.nombre}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {[s.financiador?.nombre, s.ejercicio ?? "Para estudiar", info.label].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {ya && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Ya está en esta" />}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                {mostrarOtros && (
                  <CommandGroup>
                    <CommandItem value="__otros__" onSelect={() => setTodosLosAnios(true)} className="text-muted-foreground">
                      Ver las de otros años
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            Entra por {formatCurrency(libre)} (todo lo libre). La parte se ajusta luego en la subvención.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
