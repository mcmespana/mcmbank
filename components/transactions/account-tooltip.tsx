"use client"

import { cn } from "@/lib/utils"

import type React from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Building2, PiggyBank } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"

interface AccountTooltipProps {
  account?: Cuenta
  children: React.ReactNode
}

export function AccountTooltip({ account, children }: AccountTooltipProps) {
  if (!account) {
    return <>{children}</>
  }

  const isCash = account.tipo === "caja"

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: account.color || "#4ECDC4" }}
            >
              {isCash ? <PiggyBank className="h-5 w-5 text-white" /> : <Building2 className="h-5 w-5 text-white" />}
            </div>
            <div>
              <h4 className="font-semibold text-sm">{account.nombre}</h4>
              <p className="text-xs text-muted-foreground">{isCash ? "Caja - Efectivo" : account.banco_nombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs font-medium",
                isCash
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
              )}
            >
              {isCash ? (
                <>
                  <PiggyBank className="h-3 w-3 mr-1" />
                  Caja
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3 mr-1" />
                  Banco
                </>
              )}
            </Badge>
          </div>

          {account.iban && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">IBAN</p>
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{account.iban}</code>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
