"use client"

import type { GridStackWidgetConfig } from "@/lib/config/dashboard-layouts"
import { GripVertical } from "lucide-react"

interface GridStackWidgetProps {
  config: GridStackWidgetConfig
  locked: boolean
  children: React.ReactNode
}

export function GridStackWidget({ config, locked, children }: GridStackWidgetProps) {
  return (
    <div
      className="grid-stack-item"
      gs-id={config.id}
      gs-x={config.x}
      gs-y={config.y}
      gs-w={config.w}
      gs-h={config.h}
      gs-min-w={config.minW}
      gs-min-h={config.minH}
    >
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
