"use client"

import React from "react"
import { FileText, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionIndicatorsProps {
  hasDescription?: boolean
  description?: string
  fileCount?: number
  className?: string
}

export function TransactionIndicators({ 
  hasDescription = false, 
  description, 
  fileCount = 0, 
  className 
}: TransactionIndicatorsProps) {
  if (!hasDescription && fileCount === 0) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Indicador de descripción */}
      {hasDescription && description && (
        <div className="relative cursor-help" title={description}>
          <MessageSquare className="h-4 w-4 text-blue-500" />
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}

      {/* Indicador de archivos */}
      {fileCount > 0 && (
        <div className="relative cursor-help" title={fileCount === 1 ? '1 archivo adjunto' : `${fileCount} archivos adjuntos`}>
          <FileText className="h-4 w-4 text-green-500" />
          {fileCount > 1 && (
            <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-green-500 text-white text-xs font-medium flex items-center justify-center">
              {fileCount > 9 ? '9+' : fileCount}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
