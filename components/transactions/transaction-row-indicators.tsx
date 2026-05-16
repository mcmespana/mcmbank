"use client"

import React from "react"
import { FileText, HandCoins, MessageSquare } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TransactionRowIndicatorsProps {
  description?: string | null
  fileCount?: number
  pagoMcmId?: string | null
  className?: string
  onOpenFiles?: () => void
}

export function TransactionRowIndicators({
  description,
  fileCount = 0,
  pagoMcmId,
  className,
  onOpenFiles,
}: TransactionRowIndicatorsProps) {
  const trimmedDescription = description?.trim() ?? ""
  const hasDescription = !!trimmedDescription
  const hasFiles = fileCount > 0
  const hasPagoMcm = Boolean(pagoMcmId)

  if (!hasDescription && !hasFiles && !hasPagoMcm) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Indicador de descripción: móvil (popover al clic) */}
      {hasDescription && (
        <div className="sm:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-auto p-0 hover:bg-transparent"
                onClick={(e) => e.stopPropagation()}
                aria-label="Ver descripción"
              >
                <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <MessageSquare className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-3" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                  Descripción
                </h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap select-text">
                  {trimmedDescription}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Indicador de descripción: escritorio (hover rápido + click inmediato) */}
      {hasDescription && (
        <div className="hidden sm:inline-flex">
          <Popover>
            <PopoverTrigger asChild>
              <div>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation()
                          // El Popover se abrirá inmediatamente por ser el trigger
                        }}
                        aria-label="Descripción"
                      >
                        <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <MessageSquare className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-[calc(100vw-2rem)] sm:w-96 sm:max-w-[32rem] p-3 whitespace-pre-wrap">
                      {trimmedDescription}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 sm:max-w-[32rem] p-3" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                  Descripción
                </h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap select-text">
                  {trimmedDescription}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Indicador de Pago MCM */}
      {hasPagoMcm && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center" aria-label="Pago MCM">
                <HandCoins className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">Vinculado a un Pago MCM</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Indicador de archivos */}
      {hasFiles && (
        <Button
          variant="ghost"
          className="h-auto p-0 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation()
            onOpenFiles?.()
          }}
          aria-label="Archivos adjuntos"
        >
          <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" />
          </div>
        </Button>
      )}
    </div>
  )
}
