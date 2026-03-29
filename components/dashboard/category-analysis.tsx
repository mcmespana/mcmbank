"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX, TrendingUp, TrendingDown, BarChart3, ArrowUpDown, Filter } from "lucide-react"
import { CategoryMegaSelector } from "@/components/transactions/category-mega-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDebouncedCategoryFilter } from "@/hooks/use-debounced-state"
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
import { buildExpandedCategoryIds } from "@/lib/utils/category-utils"
import { GridStackDashboard } from "./gridstack-dashboard"
import { GridStackWidget } from "./gridstack-widget"
import { ANALYSIS_DEFAULT_LAYOUT } from "@/lib/config/dashboard-layouts"

interface Props {
  from: string
  to: string
  resetToken?: number
  locked: boolean
}

type SortField = "category" | "income" | "expense" | "balance" | "default"

function getWidgetConfig(id: string) {
  return ANALYSIS_DEFAULT_LAYOUT.find((w) => w.id === id)!
}

export function CategoryAnalysisDashboard({ from, to, resetToken, locked }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const [isLoaded, setIsLoaded] = useState(false)

  const { categoryIds, selectedCategories, setCategoryIds, isPending } = useDebouncedCategoryFilter([])
  const [sortField, setSortField] = useState<SortField>("default")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectorOpen, setSelectorOpen] = useState(false)

  const { categorias } = useCategorias(selectedDelegation)
  const expandedCategoryIds = useMemo(
    () => buildExpandedCategoryIds(categoryIds, categorias),
    [categoryIds, categorias],
  )
  const { movimientos } = useMovimientos(
    selectedDelegation,
    {
      fechaDesde: from,
      fechaHasta: to,
      categoriaIds: expandedCategoryIds.length ? expandedCategoryIds : undefined,
    },
    { pageSize: 0 }
  )

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = window.localStorage.getItem("mcmbank-dashboard-analysis-categories")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategoryIds(parsed)
          }
        }
      } catch (error) {
        console.warn("Error loading categories from local storage", error)
      } finally {
        setIsLoaded(true)
      }
    }

    loadFromStorage()
  }, [setCategoryIds])

  useEffect(() => {
    if (!isLoaded) return

    try {
      window.localStorage.setItem("mcmbank-dashboard-analysis-categories", JSON.stringify(selectedCategories))
    } catch (error) {
      console.warn("Error saving categories to local storage", error)
    }
  }, [selectedCategories, isLoaded])

  useEffect(() => {
    if (!resetToken) return
    setCategoryIds([])
  }, [resetToken, setCategoryIds])

  const aggregate = useMemo(() => {
    const ingresoMap = new Map<string, { id: string; name: string; value: number; emoji?: string }>()
    const gastoMap = new Map<string, { id: string; name: string; value: number; emoji?: string }>()

    movimientos.forEach((m) => {
      const id = m.categoria_id || "uncategorized"
      const name = m.categoria?.nombre || "Sin etiqueta"
      const emoji = m.categoria?.emoji || undefined
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

  const PieTooltip = ({ active, payload, total }: any) => {
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

  const renderPieContent = (
    data: { id: string; name: string; value: number; emoji?: string }[],
    title: string,
    icon: React.ReactNode,
  ) => {
    const getCategoryColor = (categoryId: string, index: number) => {
      const categoria = categorias.find((c) => c.id === categoryId)
      if (categoria?.color) {
        return categoria.color
      }
      const colors = [
        "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
        "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
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
      <Card className="h-full border-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={dataWithColors}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {dataWithColors.map((d) => (
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

  const hasData = movimientos.length > 0

  return (
    <>
      <div className="text-sm text-muted-foreground mb-6">
        Para comprender los ingresos y los gastos de un periodo de tiempo (este mes, todo el curso...)
      </div>

      <GridStackDashboard tabId="categorias" locked={locked}>
        <GridStackWidget config={getWidgetConfig("filter-panel")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle>Filtrar por Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setSelectorOpen(true)}
              >
                <Filter className="h-4 w-4" />
                {selectedCategories.length === 0
                  ? "Seleccionar categorías..."
                  : `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${selectedCategories.length !== 1 ? "s" : ""}`}
              </Button>
              {isPending && (
                <p className="text-xs text-muted-foreground mt-2">Aplicando filtros...</p>
              )}
            </CardContent>
          </Card>
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("income-pie")} locked={locked}>
          {!hasData ? (
            <EmptyState
              title="No se han encontrado movimientos"
              description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
              icon={<SearchX className="h-6 w-6" />}
            >
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </EmptyState>
          ) : aggregate.ingresos.length > 0 ? (
            renderPieContent(
              aggregate.ingresos,
              "Distribución de Ingresos",
              <TrendingUp className="h-5 w-5 text-green-600" />,
            )
          ) : (
            <EmptyState
              title="Sin ingresos"
              description="No hay ingresos en el periodo seleccionado."
              icon={<TrendingUp className="h-6 w-6" />}
            />
          )}
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("expense-pie")} locked={locked}>
          {!hasData ? (
            <EmptyState
              title="No se han encontrado movimientos"
              description="Prueba con otro periodo de tiempo."
              icon={<SearchX className="h-6 w-6" />}
            />
          ) : aggregate.gastos.length > 0 ? (
            renderPieContent(
              aggregate.gastos,
              "Distribución de Gastos",
              <TrendingDown className="h-5 w-5 text-red-600" />,
            )
          ) : (
            <EmptyState
              title="Sin gastos"
              description="No hay gastos en el periodo seleccionado."
              icon={<TrendingDown className="h-6 w-6" />}
            />
          )}
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("comparison-bar")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparativa por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.length > 0 ? (
                <ChartContainer
                  config={{
                    income: { label: "Ingresos", color: "hsl(var(--chart-1))" },
                    expense: { label: "Gastos", color: "hsl(var(--chart-2))" },
                  }}
                  className="h-[300px]"
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
              ) : (
                <EmptyState
                  title="Sin datos"
                  description="No hay datos para mostrar la comparativa."
                  icon={<BarChart3 className="h-6 w-6" />}
                />
              )}
            </CardContent>
          </Card>
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("summary-table")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resumen Detallado por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.length > 0 ? (
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
              ) : (
                <EmptyState
                  title="Sin datos"
                  description="No hay datos para mostrar el resumen."
                  icon={<BarChart3 className="h-6 w-6" />}
                />
              )}
            </CardContent>
          </Card>
        </GridStackWidget>
      </GridStackDashboard>

      {selectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <CategoryMegaSelector
            categories={categorias}
            selectedCategories={selectedCategories}
            onSelectionChange={setCategoryIds}
            onClose={() => setSelectorOpen(false)}
            allowMultiple
            title="Filtrar por Categorías"
          />
        </div>
      )}
    </>
  )
}
