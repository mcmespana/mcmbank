"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Edit, 
  Trash2, 
  Copy, 
  Info, 
  Building, 
  Banknote as BanknoteIcon,
  Wallet,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { useAccountBalance } from "@/hooks/use-account-balance"
import type { CuentaConDelegacion } from "@/lib/types/database"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AccountCardProps {
  account: CuentaConDelegacion
  onEdit: (account: CuentaConDelegacion) => void
  onDelete: (account: CuentaConDelegacion) => void
}

// Bank color mapping for known banks
const bankColors: Record<string, string> = {
  "banco santander": "#ec0000",
  "bbva": "#004cdb",
  "caixabank": "#0066b3",
  "banco sabadell": "#0075c2",
  "bankinter": "#f37021",
  "ing": "#ff6200",
  "openbank": "#00a99d",
  "unicaja": "#009639",
  "default": "#6b7280"
}

// Bank logos (you can add SVG icons or use icon fonts)
const bankLogos: Record<string, string> = {
  "banco santander": "🏦", // Replace with actual logo
  "bbva": "🏦", // Replace with actual logo  
  "caixabank": "🏦", // Replace with actual logo
  "banco sabadell": "🏦", // Replace with actual logo
  "bankinter": "🏦", // Replace with actual logo
  "ing": "🏦", // Replace with actual logo
  "openbank": "🏦", // Replace with actual logo
  "unicaja": "🏦", // Replace with actual logo
}

function getBankColor(bankName: string | null): string {
  if (!bankName) return bankColors.default
  const normalizedName = bankName.toLowerCase()
  return bankColors[normalizedName] || bankColors.default
}

function getBankLogo(bankName: string | null): string | null {
  if (!bankName) return null
  const normalizedName = bankName.toLowerCase()
  return bankLogos[normalizedName] || null
}

function getConnectionBadge(origen: string) {
  switch (origen) {
    case "conectada":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Conectada
        </Badge>
      )
    case "manual":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
          <XCircle className="w-3 h-3 mr-1" />
          Manual
        </Badge>
      )
    default:
      return null
  }
}

function formatIban(iban: string): string {
  // Format IBAN in groups of 4 characters
  return iban.replace(/(.{4})/g, '$1 ').trim()
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const { balance, loading: balanceLoading } = useAccountBalance(account.id)
  const [copied, setCopied] = useState(false)

  const handleCopyIban = async () => {
    if (!account.iban) return
    
    await copyToClipboard(account.iban)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const bankColor = account.color || getBankColor(account.banco_nombre)
  const bankLogo = getBankLogo(account.banco_nombre)
  
  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Account Avatar */}
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold relative"
              style={{ backgroundColor: bankColor }}
            >
              {account.tipo === "caja" ? (
                <Wallet className="w-8 h-8" />
              ) : bankLogo ? (
                <span>{bankLogo}</span>
              ) : (
                <Building className="w-8 h-8" />
              )}
              
              {/* Connection Badge for Banks */}
              {account.tipo === "banco" && account.origen && (
                <div className="absolute -bottom-1 -right-1">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    account.origen === "conectada" ? "bg-green-500" : "bg-gray-400"
                  )}>
                    {account.origen === "conectada" ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <XCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              {/* Account Title */}
              <h3 className="text-xl font-bold text-foreground mb-1">
                {account.nombre}
              </h3>
              
              {/* Bank Name or Type */}
              <p className="text-muted-foreground text-sm">
                {account.tipo === "caja" ? "Caja" : account.banco_nombre || "Banco"}
              </p>
              
              {/* Connection Badge */}
              {account.tipo === "banco" && (
                <div className="mt-2">
                  {getConnectionBadge(account.origen)}
                </div>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {account.descripcion && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{account.descripcion}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-600 hover:bg-gray-50"
              onClick={() => onEdit(account)}
              title="Editar cuenta"
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(account)}
              title="Eliminar cuenta"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* IBAN Display */}
        {account.iban && account.tipo === "banco" && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">IBAN</p>
                <p className="font-mono text-sm text-foreground">
                  {formatIban(account.iban)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 transition-colors",
                  copied ? "text-green-600" : "text-gray-600 hover:bg-gray-50"
                )}
                onClick={handleCopyIban}
                title="Copiar IBAN"
              >
                <Copy className={cn("h-4 w-4", copied && "animate-pulse")} />
              </Button>
            </div>
          </div>
        )}
        
        {/* Authorized Persons */}
        {account.personas_autorizadas && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Personas autorizadas</p>
            <div className="flex flex-wrap gap-1">
              {account.personas_autorizadas.split(',').map((person, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {person.trim()}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Balance */}
        <div className="pt-4 border-t">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    balance >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {balanceLoading ? (
                      <span className="animate-pulse">Calculando...</span>
                    ) : (
                      `${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€`
                    )}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Saldo calculado según las transacciones en la aplicación,<br />puede no coincidir con el banco si se ha desincronizado</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}