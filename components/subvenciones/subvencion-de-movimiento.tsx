"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Landmark } from "lucide-react"
import { subvencionesKey } from "@/hooks/use-subvenciones"
import { subvencionesDeMovimiento } from "@/lib/services/subvenciones"
import { porcentajeDe } from "@/lib/utils/subvenciones"
import { formatCurrency } from "@/lib/utils/format"

/**
 * "Imputado a una subvención", en el detalle de un movimiento, con la parte de
 * cada una si está repartido. Solo para gestores centrales (a los demás la RLS
 * les devolvería siempre vacío). Es la respuesta a "¿este gasto ya lo he
 * usado?" sin salir de Movimientos.
 */
export function SubvencionDeMovimiento({
  movimientoId,
  importe,
}: {
  movimientoId: string | null | undefined
  importe?: number | null
}) {
  const { data } = useQuery({
    queryKey: [...subvencionesKey, "de-movimiento", movimientoId],
    queryFn: () => subvencionesDeMovimiento(movimientoId as string),
    enabled: Boolean(movimientoId),
  })

  if (!data?.length) return null
  const total = Math.abs(importe ?? 0)
  const imputado = data.reduce((a, s) => a + s.importe_imputado, 0)
  const libre = total - imputado

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Landmark className="h-3.5 w-3.5" />
        </span>
        {data.length === 1 ? "Imputado a una subvención" : `Repartido entre ${data.length} subvenciones`}
        {total > 0 && libre > 0.005 && (
          <span className="font-normal text-muted-foreground">· {formatCurrency(libre)} libres</span>
        )}
      </div>
      <ul className="space-y-1">
        {data.map((s) => (
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
