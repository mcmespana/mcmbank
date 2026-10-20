"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMonthlyTrendData } from "@/hooks/use-monthly-trend-data"
import { memo, useMemo } from "react"
import { parse, format } from "date-fns"
import { es } from "date-fns/locale"
import { FlujoChart, type PuntoFlujo } from "@/components/dashboard/flujo-chart"

interface Props {
  from: string
  to: string
}

// from/to son primitivos: memo evita recalcular el gráfico cuando el
// dashboard padre re-renderiza por otro motivo.
export const MonthlyTrend = memo(function MonthlyTrend({ from, to }: Props) {
  const { trend } = useMonthlyTrendData(from, to)

  const datos = useMemo<PuntoFlujo[]>(() => {
    // El año solo bajo la barra cuando el periodo pasa de un año a otro: si no, es ruido.
    const variosAnios = new Set(trend.map((r) => r.mes.slice(0, 4))).size > 1
    return trend.map((row) => {
      const mes = parse(row.mes, "yyyy-MM", new Date())
      return {
        etiqueta: format(mes, variosAnios ? "MMM yy" : "MMM", { locale: es }),
        etiquetaLarga: format(mes, "MMMM yyyy", { locale: es }),
        ingresos: row.ingresos,
        gastos: row.gastos,
        linea: row.ingresos - row.gastos,
      }
    })
  }, [trend])

  if (datos.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Tendencia mensual</h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lo que entra y lo que sale cada mes</CardTitle>
        </CardHeader>
        <CardContent>
          <FlujoChart datos={datos} lineaLabel="Balance del mes" />
        </CardContent>
      </Card>
    </div>
  )
})
