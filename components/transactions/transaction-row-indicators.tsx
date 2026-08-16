"use client"

import React from "react"
import { AlertTriangle, FileText, HandCoins, MessageSquare, Receipt } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TransactionRowIndicatorsProps {
  description?: string | null
  fileCount?: number
  pagoMcmId?: string | null
  facturaPendiente?: boolean
  /** Id de la factura de la bandeja vinculada a este movimiento, si la hay. */
  facturaId?: string | null
  className?: string
  onOpenFiles?: () => void
}

export function TransactionRowIndicators({
  description,
  fileCount = 0,
  pagoMcmId,
  facturaPendiente,
  facturaId,
  className,
  onOpenFiles,
}: TransactionRowIndicatorsProps) {
  const trimmedDescription = description?.trim() ?? ""
  const hasDescription = !!trimmedDescription
  const hasFiles = fileCount > 0
  const hasPagoMcm = Boolean(pagoMcmId)
  const hasFactura = Boolean(facturaId)

  if (!hasDescription && !hasFiles && !hasPagoMcm && !facturaPendiente && !hasFactura) {
    return null
  }

  // Van siempre en línea. Apilarlos de dos en dos ahorraba ancho sobre el papel,
  // pero cada fila acababa con los iconos a una altura distinta según cuántos
  // tuviera, y la lista se leía como si estuviera rota.
  return (
    <div className={cn("flex shrink-0 items-center gap-1 sm:gap-1.5", className)}>
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
                <div className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
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
                        <div className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
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
              <div className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center" aria-label="Pago MCM">
                <HandCoins className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">Vinculado a un Pago MCM</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Indicador de factura vinculada desde la bandeja de Facturas. Mismo
          tamaño que el resto (en móvil no cabe más), en un tono distinto para
          que se distinga de un archivo adjunto suelto: aquí hay una factura
          registrada, no solo un papel colgado del movimiento. */}
      {hasFactura && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center"
                aria-label="Factura vinculada"
              >
                <Receipt className="h-3 w-3 text-sky-700 dark:text-sky-300" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">Vinculado a una factura</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Indicador de factura pendiente (marca manual). Si ya hay una factura
          vinculada la marca se contradice, así que no se pinta. */}
      {facturaPendiente && !hasFactura && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center"
                aria-label="Falta factura"
              >
                <AlertTriangle className="h-3 w-3 text-amber-700 dark:text-amber-300" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">Falta la factura de este movimiento</TooltipContent>
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
          <div className="h-[18px] w-[18px] sm:h-5 sm:w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" />
          </div>
        </Button>
      )}
    </div>
  )
}
