"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

export interface PuntoFlujo {
  /** Lo que se lee bajo la barra: "sep", "13 oct". */
  etiqueta: string
  /** Lo que se lee en el tooltip: "septiembre 2026", "13–19 oct 2026". */
  etiquetaLarga: string
  ingresos: number
  /** En positivo: se pinta hacia abajo. */
  gastos: number
  /** La línea: el balance del periodo o el saldo acumulado. */
  linea: number
}

const COLOR = {
  ingresos: "#10b981",
  gastos: "#f43f5e",
  linea: "oklch(var(--primary))",
}

/** "10,5k", "-3k", "850": el eje no necesita céntimos. */
function eurosEje(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: abs >= 10000 ? 0 : 1 })}k`
  return Math.round(n).toLocaleString("es-ES")
}

/**
 * Ingresos hacia arriba y gastos hacia abajo, en barras, y una línea encima
 * (balance o saldo). Sustituye a las tres líneas que había: con dos meses eran
 * tres rectas cruzándose que no decían nada, los ejes iban sin unidad y el
 * tooltip enseñaba "10432.5" sin euros. Las barras se leen aunque haya un solo
 * periodo, y arriba/abajo dice entra/sale sin mirar la leyenda.
 */
export function FlujoChart({
  datos,
  lineaLabel,
  className,
}: {
  datos: PuntoFlujo[]
  lineaLabel: string
  className?: string
}) {
  const filas = datos.map((d) => ({ ...d, gastosNeg: -d.gastos }))

  return (
    <div className={cn("space-y-3", className)}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
        <Leyenda color={COLOR.ingresos} label="Ingresos" />
        <Leyenda color={COLOR.gastos} label="Gastos" />
        <Leyenda color={COLOR.linea} label={lineaLabel} linea />
      </ul>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filas}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            // Ingresos y gastos en la misma columna, uno hacia arriba y otro hacia abajo.
            stackOffset="sign"
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} stroke="oklch(var(--border))" />
            <XAxis
              dataKey="etiqueta"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
              tickFormatter={eurosEje}
            />
            <ReferenceLine y={0} stroke="oklch(var(--muted-foreground) / 0.5)" />
            <Tooltip cursor={{ fill: "oklch(var(--muted) / 0.6)", stroke: "none" }} content={<TooltipFlujo lineaLabel={lineaLabel} />} />
            <Bar dataKey="ingresos" stackId="flujo" fill={COLOR.ingresos} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="gastosNeg" stackId="flujo" fill={COLOR.gastos} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line
              type="monotone"
              dataKey="linea"
              stroke={COLOR.linea}
              strokeWidth={2}
              dot={{ r: 3, fill: COLOR.linea, stroke: "oklch(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: COLOR.linea, stroke: "oklch(var(--card))", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Leyenda({ color, label, linea = false }: { color: string; label: string; linea?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cn("shrink-0", linea ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </li>
  )
}

function TooltipFlujo({ active, payload, lineaLabel }: any) {
  const d = payload?.[0]?.payload as PuntoFlujo | undefined
  if (!active || !d) return null
  const fila = (color: string, label: string, valor: number, signo = false, fuerte = false) => (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("ml-auto pl-4 tabular-nums", fuerte && "font-semibold")}>
        {signo && valor > 0 ? "+" : ""}
        {formatCurrency(valor)}
      </span>
    </div>
  )
  return (
    <div className="min-w-48 space-y-1.5 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="font-medium first-letter:uppercase">{d.etiquetaLarga}</p>
      {fila(COLOR.ingresos, "Ingresos", d.ingresos)}
      {fila(COLOR.gastos, "Gastos", -d.gastos)}
      <div className="border-t pt-1.5">{fila(COLOR.linea, lineaLabel, d.linea, true, true)}</div>
    </div>
  )
}
