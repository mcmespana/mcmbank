"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delayDuration?: number
  className?: string
}

export function Tooltip({ 
  content, 
  children, 
  side = "top", 
  align = "center", 
  delayDuration = 200,
  className 
}: TooltipProps) {
  const [open, setOpen] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div 
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen(!open)} // For mobile tap
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side={side}
        align={align}
        className={cn(
          "px-3 py-2 text-sm bg-popover text-popover-foreground border rounded-md shadow-md max-w-xs",
          className
        )}
        sideOffset={5}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
