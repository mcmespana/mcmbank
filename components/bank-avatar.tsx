"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building2, PiggyBank } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"
import { cn } from "@/lib/utils"

interface BankAvatarProps {
  bankName?: string
  accountColor?: string
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

export function BankAvatar({ bankName, accountColor, account, size = "md" }: BankAvatarProps) {
  const finalBankName = bankName || account?.banco_nombre || account?.nombre || "Caja"
  const finalAccountColor = accountColor || account?.color

  const normalizedName = finalBankName.toLowerCase()
  const isCashAccount = account?.tipo === "caja" || normalizedName.includes("caja") || normalizedName.includes("efectivo")

  const isCaixabank = normalizedName.includes("caixabank") || normalizedName.includes("caixa") || normalizedName.includes("la caixa")
  const isSabadell =
    normalizedName.includes("sabadell") || normalizedName.includes("banco sabadell") || normalizedName.includes("banc sabadell")

  const baseLogo = useMemo(() => {
    if (isCaixabank) return "/bank-logos/caixabank.png"
    if (isSabadell) return "/bank-logos/sabadell.png"
    return null
  }, [isCaixabank, isSabadell])

  const [logoSrc, setLogoSrc] = useState<string | null>(baseLogo)

  useEffect(() => {
    setLogoSrc(baseLogo)
  }, [baseLogo])

  const shouldShowLogo = !isCashAccount && Boolean(logoSrc)

  const handleImageError = () => {
    if (!logoSrc) return

    if (logoSrc.endsWith(".png")) {
      setLogoSrc(logoSrc.replace(".png", ".jpg"))
      return
    }

    if (logoSrc.endsWith(".jpg")) {
      setLogoSrc(null)
    }
  }

  const avatarSizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  const iconSizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"

  return (
    <Avatar className={avatarSizeClass}>
      {shouldShowLogo && logoSrc ? (
        <AvatarImage src={logoSrc} onError={handleImageError} alt={finalBankName} className="object-contain p-1" />
      ) : null}
      <AvatarFallback
        className={cn(
          "text-white font-semibold flex items-center justify-center",
          isCashAccount
            ? "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600"
            : "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600",
        )}
        style={
          !shouldShowLogo && finalAccountColor
            ? {
                background: finalAccountColor,
              }
            : undefined
        }
      >
        {isCashAccount ? <PiggyBank className={iconSizeClass} /> : <Building2 className={iconSizeClass} />}
      </AvatarFallback>
    </Avatar>
  )
}
