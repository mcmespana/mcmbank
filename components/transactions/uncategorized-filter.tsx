"use client"

import { Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface UncategorizedFilterProps {
  active: boolean
  count: number
  onToggle: (active: boolean) => void
}

export function UncategorizedFilter({ active, count, onToggle }: UncategorizedFilterProps) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => onToggle(!active)}
      className="gap-2 relative"
    >
      <Tag className="h-4 w-4" />
      Sin categoría
      {count > 0 && (
        <Badge 
          variant={active ? "secondary" : "default"} 
          className="ml-1 text-xs min-w-[20px] h-5"
        >
          {count}
        </Badge>
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(false)
          }}
          className="h-4 w-4 p-0 ml-1 hover:bg-white/20"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Button>
  )
}