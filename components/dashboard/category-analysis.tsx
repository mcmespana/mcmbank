"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX, TrendingUp, TrendingDown, BarChart3, ArrowUpDown } from "lucide-react"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  type TooltipProps,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/format"
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { Timeframe } from "./timeframe-filter"

interface Props {
  timeframe: Timeframe
  from: string
  to: string
}

type SortField = "category" | "income" | "expense" | "balance" | "default"

export function CategoryAnalysisDashboard({ timeframe, from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>("default")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const { categorias } = useCategorias(selectedDelegation)
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
    categoriaIds: categoryIds.length ? categoryIds : undefined,
  })

  const aggregate = useMemo(() => {
    const ingresoMap = new Map<string, { id: string; name: string; value: number; emoji?: string }>()
    const gastoMap = new Map<string, { id: string; name: string; value: number; emoji?: string }>()

    movimientos.forEach((m) => {
      const id = m.categoria_id || "uncategorized"
      const name = m.categoria?.nombre || "Sin etiqueta"
      const emoji = m.categoria?.emoji
      const map = m.importe > 0 ? ingresoMap : gastoMap
      const entry = map.get(id) || { id, name, value: 0, emoji }
      entry.value += Math.abs(m.importe)
      map.set(id, entry)
    })

    return {
      ingresos: Array.from(ingresoMap.values()),
      gastos: Array.from(gastoMap.values()),
    }
  }, [movimientos])

  const summary = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; income: number; expense: number; emoji?: string; order?: number }
    >()

    aggregate.ingresos.forEach((i) => {
      const categoria = categorias.find((c) => c.id === i.id)
      map.set(i.id, { id: i.id, name: i.name, income: i.value, expense: 0, emoji: i.emoji, order: categoria?.orden })
    })
    aggregate.gastos.forEach((g) => {
      const existing = map.get(g.id)
      const categoria = categorias.find((c) => c.id === g.id)
      if (existing) {
        existing.expense = g.value
      } else {
        map.set(g.id, { id: g.id, name: g.name, income: 0, expense: g.value, emoji: g.emoji, order: categoria?.orden })
      }
    })

    const result = Array.from(map.values())

    if (sortField === "default") {
      result.sort((a, b) => (a.order || 999) - (b.order || 999))
    } else if (sortField === "category") {
      result.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name)
        return sortDirection === "asc" ? comparison : -comparison
      })
    } else if (sortField === "income") {
      result.sort((a, b) => {
        const comparison = a.income - b.income
        return sortDirection === "asc" ? comparison : -comparison
      })
    } else if (sortField === "expense") {
      result.sort((a, b) => {
        const comparison = a.expense - b.expense
        return sortDirection === "asc" ? comparison : -comparison
      })
    } else if (sortField === "balance") {
      result.sort((a, b) => {
        const comparison = a.income - a.expense - (b.income - b.expense)
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return result
  }, [aggregate, categorias, sortField, sortDirection])

  const buildConfig = (data: { id: string; name: string; value: number }[]): ChartConfig => {
    const colors = [1, 2, 3, 4, 5]
    return Object.fromEntries(
      data.map((d, i) => [d.id, { label: d.name, color: `hsl(var(--chart-${colors[i % colors.length]}))` }]),
    )
  }

  const clearFilters = () => {
    setCategoryIds([])
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const PieTooltip = ({ active, payload, total }: TooltipProps<number, string> & { total: number }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as { name: string; value: number; id: string; emoji?: string; fill: string }
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0"
    return (
      <div className="grid gap-2 rounded-md border bg-background p-3 text-sm shadow-lg">
        <div className="font-medium flex items-center gap-2">
          {d.emoji && <span>{d.emoji}</span>}
          {d.name}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.fill }} />
          {formatCurrency(d.value)}
          <Badge variant="secondary" className="text-xs">
            {pct}%
          </Badge>
        </div>
      </div>
    )
  }

  const renderPie = (
    data: { id: string; name: string; value: number; emoji?: string }[],
    title: string,
    icon: React.ReactNode,
  ) => {
    const getCategoryColor = (categoryId: string, index: number) => {
      const categoria = categorias.find((c) => c.id === categoryId)
      if (categoria?.color) {
        return categoria.color
      }
      // Colores vibrantes como fallback
      const colors = [
        "#3b82f6", // blue
        "#ef4444", // red
        "#10b981", // emerald
        "#f59e0b", // amber
        "#8b5cf6", // violet
        "#06b6d4", // cyan
        "#84cc16", // lime
        "#f97316", // orange
        "#ec4899", // pink
        "#6366f1", // indigo
      ]
      return colors[index % colors.length]
    }

    const dataWithColors = data.map((item, index) => ({
      ...item,
      fill: getCategoryColor(item.id, index),
    }))

    const config = buildConfig(data)
    const total = data.reduce((sum, d) => sum + d.value, 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={dataWithColors}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {dataWithColors.map((d, index) => (
                    <Cell key={d.id} fill={d.fill} />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip total={total} />} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Para comprender los ingresos y los gastos de un periodo de tiempo (este mes, todo el curso...)
        </div>
        <div className="w-80">
          <CategorySelector
            categories={categorias}
            selectedCategories={categoryIds}
            onSelectionChange={setCategoryIds}
            allowMultiple
            placeholder="Filtrar categorías..."
          />
        </div>
      </div>

      {movimientos.length === 0 ? (
        <EmptyState
          title="No se han encontrado movimientos"
          description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
          icon={<SearchX className="h-6 w-6" />}
        >
          <Button variant="outline" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {aggregate.ingresos.length > 0 &&
              renderPie(
                aggregate.ingresos,
                "Distribución de Ingresos",
                <TrendingUp className="h-5 w-5 text-green-600" />,
              )}
            {aggregate.gastos.length > 0 &&
              renderPie(aggregate.gastos, "Distribución de Gastos", <TrendingDown className="h-5 w-5 text-red-600" />)}
          </div>

          {summary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Comparativa por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    income: { label: "Ingresos", color: "hsl(var(--chart-1))" },
                    expense: { label: "Gastos", color: "hsl(var(--chart-2))" },
                  }}
                  className="h-[400px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => (value.length > 15 ? `${value.substring(0, 15)}...` : value)}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="income" fill="var(--color-income)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="expense" fill="var(--color-expense)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {summary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resumen Detallado por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-semibold"
                          onClick={() => handleSort("category")}
                        >
                          Categoría
                          {sortField === "category" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-semibold"
                          onClick={() => handleSort("income")}
                        >
                          Ingresos
                          {sortField === "income" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-semibold"
                          onClick={() => handleSort("expense")}
                        >
                          Gastos
                          {sortField === "expense" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-semibold"
                          onClick={() => handleSort("balance")}
                        >
                          Balance
                          {sortField === "balance" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="flex items-center gap-2">
                          {s.emoji && <span className="text-lg">{s.emoji}</span>}
                          <span className="font-medium">{s.name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.income ? (
                            <span className="text-green-600 font-medium">{formatCurrency(s.income)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.expense ? (
                            <span className="text-red-600 font-medium">{formatCurrency(s.expense)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.income - s.expense >= 0 ? "default" : "destructive"}>
                            {formatCurrency(s.income - s.expense)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
