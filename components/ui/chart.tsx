"use client"

import * as React from "react"
import {
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
} from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<string, { label: string; color: string }>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

export function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig
}) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart
        className={cn("h-full w-full", className)}
        {...props}
        style={{
          ...Object.fromEntries(
            Object.entries(config).map(([key, { color }]) => [
              `--color-${key}`,
              color,
            ]),
          ),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function useChartContext() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChartContext must be used within a ChartContainer")
  return context
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <Tooltip {...props} />
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: any) {
  const { config } = useChartContext()
  if (!active || !payload?.length) return null
  return (
    <div className="grid gap-2 rounded-md border bg-background p-2 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      {payload.map((item: any) => {
        const key = item.dataKey as string
        const color = item.color ?? `var(--color-${key})`
        return (
          <div key={key} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {config[key]?.label ?? key}: {item.value}
          </div>
        )
      })}
    </div>
  )
}
