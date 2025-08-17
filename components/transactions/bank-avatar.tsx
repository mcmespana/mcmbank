"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Banknote, Building2, Link, User } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"
import { useMemo, useState } from "react"

interface BankAvatarProps {
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

const BANK_COLORS = {
  BBVA: "bg-blue-600",
  Santander: "bg-red-600",
  CaixaBank: "bg-blue-800",
  Bankia: "bg-orange-600",
  ING: "bg-orange-500",
  Openbank: "bg-green-600",
  Revolut: "bg-purple-600",
  N26: "bg-cyan-600",
  Sabadell: "bg-blue-500",
  "Banco Sabadell": "bg-blue-500",
  Unicaja: "bg-green-700",
  Kutxabank: "bg-blue-700",
  Bankinter: "bg-orange-700",
  Abanca: "bg-blue-900",
  Cajamar: "bg-green-800",
  Liberbank: "bg-purple-700",
  "Eurocaja Rural": "bg-green-600",
  Caja: "bg-amber-600",
  default: "bg-slate-600",
}

export function BankAvatar({ account, size = "md" }: BankAvatarProps) {
  if (!account) {
    return (
      <Avatar className={size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"}>
        <AvatarFallback className="bg-slate-600">
          <Banknote className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        </AvatarFallback>
      </Avatar>
    )
  }

  // Extract bank name from account name or use tipo
  const bankName = account.banco_nombre || account.nombre || "Caja"
  const isCash = bankName.toLowerCase().includes("caja") || bankName.toLowerCase().includes("efectivo")
  const isManual = account.origen === "manual"
  const isConnected = account.origen === "conectada"

  // Get bank color
  const bankColor = Object.keys(BANK_COLORS).find((bank) => bankName.toLowerCase().includes(bank.toLowerCase()))
  const colorClass = bankColor ? BANK_COLORS[bankColor as keyof typeof BANK_COLORS] : BANK_COLORS.default

  // Generate initials
  const initials = bankName
    .split(" ")
    .map((word: string) => word.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase()

  // Build asset base name: lowercase, remove diacritics and non-alphanumeric, remove spaces
  const assetBase = useMemo(() => {
    return bankName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  }, [bankName])

  // Try .png first, then .jpg, then placeholder
  const [logoSrc, setLogoSrc] = useState<string>(`/bank-logos/${assetBase}.png`)
  const handleImageError = () => {
    if (logoSrc.endsWith(".png")) {
      setLogoSrc(`/bank-logos/${assetBase}.jpg`)
    } else if (logoSrc.endsWith(`/${assetBase}.jpg`)) {
      setLogoSrc("/placeholder-logo.png")
    }
  }

  const avatarContent = (
    <Avatar className={size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"}>
      {!isCash && (
        <AvatarImage src={logoSrc} onError={handleImageError} alt={bankName} />
      )}
      <AvatarFallback className={`${colorClass} text-white font-semibold`}>
        {isCash ? (
          <Banknote className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        ) : (
          <span className={size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"}>{initials}</span>
        )}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {avatarContent}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="max-w-xs p-4 bg-white border border-gray-200 shadow-xl rounded-xl"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                {isCash ? (
                  <Banknote className="w-4 h-4 text-white" />
                ) : (
                  <Building2 className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{account.nombre}</p>
                <p className="text-xs text-gray-500">
                  {isCash ? "Caja" : "Banco"}
                </p>
              </div>
            </div>

            {/* Bank Info */}
            {!isCash && account.banco_nombre && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{account.banco_nombre}</span>
              </div>
            )}

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isManual ? (
                <User className="w-4 h-4 text-orange-500" />
              ) : (
                <Link className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm text-gray-700">
                {isManual ? "Cuenta manual" : "Cuenta conectada"}
              </span>
            </div>

            {/* IBAN if available */}
            {account.iban && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-mono">{account.iban}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
