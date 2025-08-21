"use client"

import React from "react"
import { FileText, MessageSquare } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TransactionRowIndicatorsProps {
  description?: string | null
  fileCount?: number
  className?: string
}

export function TransactionRowIndicators({ 
  description,
  fileCount = 0,
  className 
}: TransactionRowIndicatorsProps) {
  const hasDescription = !!description?.trim()
  const hasFiles = fileCount > 0

  if (!hasDescription && !hasFiles) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Indicador de descripción con tooltip */}
      {hasDescription && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
              <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <MessageSquare className="h-3 w-3 text-gray-600 dark:text-gray-400" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-600" />
                Descripción
              </h4>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {description}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Indicador de archivos */}
      {hasFiles && (
        <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" />
        </div>
      )}
    </div>
  )
}
