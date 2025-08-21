"use client"

import React from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface TabWithCounterProps {
  label: string
  count?: number
  isActive?: boolean
  onClick?: () => void
  className?: string
}

export function TabWithCounter({ 
  label, 
  count = 0, 
  isActive = false, 
  onClick, 
  className 
}: TabWithCounterProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive 
          ? "bg-background text-foreground shadow-sm" 
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <div className="ml-2 flex items-center gap-1">
          <FileText className="h-3 w-3" />
          <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-medium min-w-[1.25rem] text-center">
            {count > 99 ? '99+' : count}
          </span>
        </div>
      )}
    </button>
  )
}
