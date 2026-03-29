"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import "gridstack/dist/gridstack.min.css"
import "@/styles/gridstack-custom.css"
import type { GridStackWidgetConfig } from "@/lib/config/dashboard-layouts"
import { getSavedLayout, saveLayout, getDefaultLayout } from "@/lib/config/dashboard-layouts"

interface GridStackDashboardProps {
  tabId: string
  locked: boolean
  children: React.ReactNode
}

export function GridStackDashboard({ tabId, locked, children }: GridStackDashboardProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const gridInstanceRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  // Keep a stable ref to tabId for event handlers
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const handleLayoutChange = useCallback(() => {
    const grid = gridInstanceRef.current
    if (!grid) return

    const items = grid.getGridItems()
    const widgets: GridStackWidgetConfig[] = items
      .map((el: any) => {
        const node = el.gridstackNode
        if (!node) return null
        return {
          id: node.id || el.getAttribute("gs-id") || "",
          x: node.x ?? 0,
          y: node.y ?? 0,
          w: node.w ?? 1,
          h: node.h ?? 1,
        }
      })
      .filter(Boolean)

    saveLayout(tabIdRef.current, widgets)
  }, [])

  useEffect(() => {
    if (!gridRef.current) return

    const initGrid = async () => {
      const { GridStack } = await import("gridstack")

      if (!gridRef.current || gridInstanceRef.current) return

      const savedLayout = getSavedLayout(tabId)
      const defaultLayout = getDefaultLayout(tabId)
      const layout = savedLayout || defaultLayout

      const grid = GridStack.init(
        {
          column: 12,
          cellHeight: 70,
          margin: 8,
          float: false,
          animate: true,
          draggable: {
            handle: ".gs-drag-handle",
          },
          resizable: {
            handles: "se",
          },
          disableDrag: locked,
          disableResize: locked,
        },
        gridRef.current!,
      )

      gridInstanceRef.current = grid

      // Apply saved layout positions to existing DOM elements
      const items = grid.getGridItems()
      items.forEach((el: HTMLElement) => {
        const widgetId = el.getAttribute("gs-id")
        const saved = layout.find((w) => w.id === widgetId)
        if (saved) {
          grid.update(el, { x: saved.x, y: saved.y, w: saved.w, h: saved.h })
        }
      })

      // Listen for layout changes
      grid.on("change", () => {
        handleLayoutChange()
        // Trigger resize for Recharts ResponsiveContainer
        window.dispatchEvent(new Event("resize"))
      })

      grid.on("resizestop", () => {
        // Extra resize event for charts to recalculate
        setTimeout(() => window.dispatchEvent(new Event("resize")), 100)
      })

      setReady(true)
    }

    initGrid()

    return () => {
      if (gridInstanceRef.current) {
        gridInstanceRef.current.destroy(false)
        gridInstanceRef.current = null
      }
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // Update lock state dynamically
  useEffect(() => {
    const grid = gridInstanceRef.current
    if (!grid) return
    grid.enableMove(!locked)
    grid.enableResize(!locked)
  }, [locked])

  return (
    <div
      ref={gridRef}
      className={`grid-stack${locked ? " grid-stack-locked" : ""}`}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
    >
      {children}
    </div>
  )
}
