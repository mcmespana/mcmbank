"use client"

import { useRef, useEffect } from "react"
import type { GridStackWidgetConfig } from "@/lib/config/dashboard-layouts"
import { GripVertical } from "lucide-react"

interface GridStackWidgetProps {
  config: GridStackWidgetConfig
  locked: boolean
  children: React.ReactNode
}

export function GridStackWidget({ config, locked, children }: GridStackWidgetProps) {
  const itemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = itemRef.current
    if (!el) return
    // Set GridStack attributes via DOM (React doesn't support custom gs-* attributes)
    el.setAttribute("gs-id", config.id)
    el.setAttribute("gs-x", String(config.x))
    el.setAttribute("gs-y", String(config.y))
    el.setAttribute("gs-w", String(config.w))
    el.setAttribute("gs-h", String(config.h))
    if (config.minW) el.setAttribute("gs-min-w", String(config.minW))
    if (config.minH) el.setAttribute("gs-min-h", String(config.minH))
  }, [config])

  return (
    <div ref={itemRef} className="grid-stack-item">
      <div className="grid-stack-item-content gs-widget-content">
        {!locked && (
          <div className="gs-drag-handle">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="gs-widget-body">
          {children}
        </div>
      </div>
    </div>
  )
}
