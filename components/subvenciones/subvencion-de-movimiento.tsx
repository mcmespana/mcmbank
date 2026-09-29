"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Landmark } from "lucide-react"
import { subvencionesKey } from "@/hooks/use-subvenciones"
import { subvencionDeMovimiento } from "@/lib/services/subvenciones"

/**
 * "Imputado en la subvención X", en el detalle de un movimiento. Solo para
 * gestores centrales (a los demás la RLS les devolvería siempre vacío). Es la
 * respuesta a "¿este gasto ya lo he usado?" sin salir de Movimientos.
 */
export function SubvencionDeMovimiento({ movimientoId }: { movimientoId: string | null | undefined }) {
  const { data } = useQuery({
    queryKey: [...subvencionesKey, "de-movimiento", movimientoId],
    queryFn: () => subvencionDeMovimiento(movimientoId as string),
    enabled: Boolean(movimientoId),
  })

  if (!data) return null

  return (
    <Link
      href={`/subvenciones/${data.id}`}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/60"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Landmark className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-xs">
        <span className="block font-medium">Imputado a una subvención</span>
        <span className="block truncate text-muted-foreground">
          {data.nombre} · {data.financiador}
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
