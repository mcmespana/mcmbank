/**
 * Default GridStack layouts for each dashboard tab.
 * Grid uses 12 columns. Each widget has:
 * - id: unique identifier matching the widget component
 * - x, y: position in grid units
 * - w, h: size in grid units
 * - minW, minH: minimum size constraints
 */

export interface GridStackWidgetConfig {
  id: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export const OVERVIEW_DEFAULT_LAYOUT: GridStackWidgetConfig[] = [
  { id: "financial-summary", x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
  { id: "financial-insights", x: 0, y: 4, w: 12, h: 3, minW: 4, minH: 2 },
  { id: "monthly-trend", x: 0, y: 7, w: 12, h: 5, minW: 6, minH: 4 },
  { id: "quick-actions", x: 0, y: 12, w: 5, h: 4, minW: 4, minH: 3 },
  { id: "recent-transactions", x: 5, y: 12, w: 7, h: 5, minW: 4, minH: 3 },
]

export const ACTIVITY_DEFAULT_LAYOUT: GridStackWidgetConfig[] = [
  { id: "summary-cards", x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  { id: "distribution-chart", x: 0, y: 3, w: 6, h: 5, minW: 4, minH: 4 },
  { id: "category-filter", x: 6, y: 3, w: 6, h: 5, minW: 4, minH: 3 },
  { id: "evolution-chart", x: 0, y: 8, w: 12, h: 5, minW: 6, minH: 4 },
]

export const ANALYSIS_DEFAULT_LAYOUT: GridStackWidgetConfig[] = [
  { id: "filter-panel", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { id: "income-pie", x: 0, y: 2, w: 6, h: 5, minW: 4, minH: 4 },
  { id: "expense-pie", x: 6, y: 2, w: 6, h: 5, minW: 4, minH: 4 },
  { id: "comparison-bar", x: 0, y: 7, w: 12, h: 5, minW: 6, minH: 4 },
  { id: "summary-table", x: 0, y: 12, w: 12, h: 5, minW: 6, minH: 3 },
]

const LAYOUT_STORAGE_PREFIX = "mcmbank-dashboard-layout-"
const LAYOUT_VERSION = 1

interface SavedLayout {
  version: number
  widgets: GridStackWidgetConfig[]
}

export function getSavedLayout(tabId: string): GridStackWidgetConfig[] | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(`${LAYOUT_STORAGE_PREFIX}${tabId}`)
    if (!stored) return null
    const parsed: SavedLayout = JSON.parse(stored)
    if (parsed.version !== LAYOUT_VERSION) return null
    return parsed.widgets
  } catch {
    return null
  }
}

export function saveLayout(tabId: string, widgets: GridStackWidgetConfig[]) {
  if (typeof window === "undefined") return
  try {
    const data: SavedLayout = { version: LAYOUT_VERSION, widgets }
    window.localStorage.setItem(`${LAYOUT_STORAGE_PREFIX}${tabId}`, JSON.stringify(data))
  } catch (error) {
    console.warn("Error saving dashboard layout", error)
  }
}

export function clearSavedLayout(tabId: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(`${LAYOUT_STORAGE_PREFIX}${tabId}`)
  } catch {
    // ignore
  }
}

export function getDefaultLayout(tabId: string): GridStackWidgetConfig[] {
  switch (tabId) {
    case "overview":
      return OVERVIEW_DEFAULT_LAYOUT
    case "actividad":
      return ACTIVITY_DEFAULT_LAYOUT
    case "categorias":
      return ANALYSIS_DEFAULT_LAYOUT
    default:
      return OVERVIEW_DEFAULT_LAYOUT
  }
}
