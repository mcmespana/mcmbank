"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  SearchX,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Scale,
  Tags,
  X,
} from "lucide-react"
import { CategoryMegaSelector } from "@/components/transactions/category-mega-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useCategoryBreakdown } from "@/hooks/use-category-breakdown"
import { useDebouncedCategoryFilter } from "@/hooks/use-debounced-state"
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"
import { formatCurrency } from "@/lib/utils/format"
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody, TableFooter } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { buildExpandedCategoryIds } from "@/lib/utils/category-utils"
import { cn } from "@/lib/utils"

interface Props {
  from: string
  to: string
  resetToken?: number
}

type SortField = "category" | "income" | "expense" | "balance" | "default"

const FALLBACK_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
]

export function CategoryAnalysisDashboard({ from, to, resetToken }: Props) {
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

  // Fetch full category breakdown from DB — one row per category, no full table scan
  const { breakdown } = useCategoryBreakdown(from, to)

  // Filter client-side when category filter is active (cheap: one row per category)
  const filteredBreakdown = useMemo(() => {
    if (expandedCategoryIds.length === 0) return breakdown
    return breakdown.filter(
      (row) => row.categoria_id !== null && expandedCategoryIds.includes(row.categoria_id),
    )
  }, [breakdown, expandedCategoryIds])

  // Load configuration from local storage on mount
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

  // Save configuration to local storage when it changes
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

  const getCategoryColor = (categoryId: string, index: number) => {
    const categoria = categorias.find((c) => c.id === categoryId)
    if (categoria?.color) return categoria.color
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  }

  // Totales del periodo (KPIs)
  const totals = useMemo(() => {
    const income = filteredBreakdown.reduce((sum, r) => sum + r.ingresos, 0)
    const expense = filteredBreakdown.reduce((sum, r) => sum + r.gastos, 0)
    return { income, expense, balance: income - expense }
  }, [filteredBreakdown])

  // Datos para donuts (con color + porcentaje precalculado)
  const aggregate = useMemo(() => {
    const build = (key: "ingresos" | "gastos") => {
      const rows = filteredBreakdown
        .filter((row) => row[key] > 0)
        .map((row) => ({
          id: row.categoria_id ?? "uncategorized",
          name: row.categoria_nombre ?? "Sin etiqueta",
          value: row[key],
          emoji: row.categoria_emoji ?? undefined,
        }))
        .sort((a, b) => b.value - a.value)
      const total = rows.reduce((sum, r) => sum + r.value, 0)
      return rows.map((r, i) => ({
        ...r,
        fill: getCategoryColor(r.id, i),
        pct: total > 0 ? (r.value / total) * 100 : 0,
      }))
    }
    return { ingresos: build("ingresos"), gastos: build("gastos") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBreakdown, categorias])

  // Tabla resumen
  const summary = useMemo(() => {
    const result = filteredBreakdown.map((row) => {
      const id = row.categoria_id ?? "uncategorized"
      const categoria = categorias.find((c) => c.id === id)
      return {
        id,
        name: row.categoria_nombre ?? "Sin etiqueta",
        income: row.ingresos,
        expense: row.gastos,
        emoji: row.categoria_emoji ?? undefined,
        order: categoria?.orden,
        incomePct: totals.income > 0 ? (row.ingresos / totals.income) * 100 : 0,
        expensePct: totals.expense > 0 ? (row.gastos / totals.expense) * 100 : 0,
      }
    })

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
  }, [filteredBreakdown, categorias, sortField, sortDirection, totals])

  const clearFilters = () => {
    setCategoryIds([])
  }

  const removeCategory = (id: string) => {
    setCategoryIds(selectedCategories.filter((c) => c !== id))
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort(field)}>
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-40" />
      )}
    </Button>
  )

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as { name: string; value: number; emoji?: string; fill: string; pct: number }
    return (
      <div className="grid gap-1.5 rounded-md border bg-background p-3 text-sm shadow-lg">
        <div className="font-medium flex items-center gap-2">
          {d.emoji && <span>{d.emoji}</span>}
          {d.name}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.fill }} />
          {formatCurrency(d.value)}
          <Badge variant="secondary" className="text-xs">
            {d.pct.toFixed(1)}%
          </Badge>
        </div>
      </div>
    )
  }

  const renderDonut = (
    data: Array<{ id: string; name: string; value: number; emoji?: string; fill: string; pct: number }>,
    title: string,
    total: number,
    icon: React.ReactNode,
  ) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[220px] w-[220px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.id} fill={d.fill} />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda detallada con porcentajes */}
          <div className="w-full min-w-0 flex-1 space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {data.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="min-w-0 flex-1 truncate">
                  {d.emoji && <span className="mr-1">{d.emoji}</span>}
                  {d.name}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.pct.toFixed(1)}%</span>
                <span className="w-20 text-right font-medium tabular-nums">
                  {formatCurrency(d.value).replace("€", "").trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const selectedChips = useMemo(
    () =>
      selectedCategories
        .map((id) => categorias.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [selectedCategories, categorias],
  )

  return (
    <div className="space-y-6">
      {/* Toolbar de filtros: compacta, con chips de categorías activas */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectorOpen(true)}>
          <Filter className="h-4 w-4" />
          Filtrar categorías
        </Button>
        {selectedChips.map((c) => (
          <Badge key={c.id} variant="secondary" className="gap-1 pr-1 font-normal">
            {c.emoji && <span>{c.emoji}</span>}
            {c.nombre}
            <button
              type="button"
              onClick={() => removeCategory(c.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Quitar ${c.nombre}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selectedCategories.length > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
            Limpiar
          </Button>
        )}
        {isPending && <span className="text-xs text-muted-foreground">Aplicando filtros...</span>}
      </div>

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

      {filteredBreakdown.length === 0 ? (
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
          {/* KPIs del periodo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    {formatCurrency(totals.income)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(totals.expense)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-muted p-2">
                  <Scale className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p
                    className={cn(
                      "text-xl font-bold tabular-nums",
                      totals.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {totals.balance >= 0 ? "+" : ""}
                    {formatCurrency(totals.balance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Donuts con leyenda */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {aggregate.ingresos.length > 0 &&
              renderDonut(
                aggregate.ingresos,
                "Ingresos por categoría",
                totals.income,
                <TrendingUp className="h-4 w-4 text-green-600" />,
              )}
            {aggregate.gastos.length > 0 &&
              renderDonut(
                aggregate.gastos,
                "Gastos por categoría",
                totals.expense,
                <TrendingDown className="h-4 w-4 text-red-600" />,
              )}
          </div>

          {/* Tabla detallada con barras de proporción */}
          {summary.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tags className="h-4 w-4" />
                  Detalle por categoría
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({summary.length} categoría{summary.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortButton field="category">Categoría</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="income">Ingresos</SortButton>
                      </TableHead>
                      <TableHead className="hidden w-[110px] md:table-cell">
                        <span className="text-xs text-muted-foreground">% ingresos</span>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="expense">Gastos</SortButton>
                      </TableHead>
                      <TableHead className="hidden w-[110px] md:table-cell">
                        <span className="text-xs text-muted-foreground">% gastos</span>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="balance">Balance</SortButton>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((s) => {
                      const rowBalance = s.income - s.expense
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {s.emoji && <span className="text-lg">{s.emoji}</span>}
                              <span className="font-medium">{s.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.income ? (
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(s.income)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {s.income > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-green-500/80"
                                    style={{ width: `${Math.min(s.incomePct, 100)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                                  {s.incomePct.toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.expense ? (
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {formatCurrency(s.expense)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {s.expense > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-red-500/80"
                                    style={{ width: `${Math.min(s.expensePct, 100)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                                  {s.expensePct.toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              rowBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {rowBalance >= 0 ? "+" : ""}
                            {formatCurrency(rowBalance)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-green-600 dark:text-green-400">
                        {formatCurrency(totals.income)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell" />
                      <TableCell className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(totals.expense)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell" />
                      <TableCell
                        className={cn(
                          "text-right font-bold tabular-nums",
                          totals.balance >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {totals.balance >= 0 ? "+" : ""}
                        {formatCurrency(totals.balance)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
