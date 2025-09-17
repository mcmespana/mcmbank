"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building2, PiggyBank } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"
import { useEffect, useMemo, useState } from "react"

interface BankAvatarProps {
  bankName?: string
  accountColor?: string
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

export function BankAvatar({ bankName, accountColor, account, size = "md" }: BankAvatarProps) {
  const finalBankName = bankName || account?.banco_nombre || account?.nombre || "Cuenta"
  const normalizedBankName = useMemo(() => finalBankName.toLowerCase(), [finalBankName])
  const finalAccountColor = accountColor || account?.color || "#4ECDC4"

  const specialBank = useMemo(() => {
    if (normalizedBankName.includes("sabadell")) {
      return "sabadell"
    }
    if (
      normalizedBankName.includes("caixabank") ||
      normalizedBankName.includes("caixa") ||
      normalizedBankName.includes("la caixa")
    ) {
      return "caixabank"
    }
    return null
  }, [normalizedBankName])

  const [logoSrc, setLogoSrc] = useState<string | null>(null)

  useEffect(() => {
    if (specialBank) {
      setLogoSrc(`/bank-logos/${specialBank}.png`)
    } else {
      setLogoSrc(null)
    }
  }, [specialBank, finalBankName])

  const handleImageError = () => {
    if (!specialBank || !logoSrc) return

    if (logoSrc.endsWith(".png")) {
      setLogoSrc(`/bank-logos/${specialBank}.jpg`)
    } else if (logoSrc.endsWith(".jpg")) {
      setLogoSrc("/placeholder-logo.png")
    }
  }

  const avatarSizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  const iconSizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"

  const isCaja = account?.tipo === "caja" || normalizedBankName.includes("caja") || normalizedBankName.includes("efectivo")
  const IconComponent = isCaja ? PiggyBank : Building2

  return (
    <Avatar
      className={`${avatarSizeClass} bg-transparent`}
      style={{ backgroundColor: finalAccountColor || "#4ECDC4" }}
    >
      {logoSrc && (
        <AvatarImage
          src={logoSrc}
          onError={handleImageError}
          alt={finalBankName}
          className="h-full w-full object-contain p-1"
        />
      )}
      <AvatarFallback
        className="flex h-full w-full items-center justify-center bg-transparent text-white"
        style={{ backgroundColor: finalAccountColor || "#4ECDC4" }}
      >
        <IconComponent className={iconSizeClass} />
      </AvatarFallback>
    </Avatar>
  )
}
