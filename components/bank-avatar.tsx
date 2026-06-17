"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Landmark, PiggyBank } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"
import { useState } from "react"

interface BankAvatarProps {
  bankName?: string
  accountColor?: string
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

export function BankAvatar({ bankName, accountColor, account, size = "md" }: BankAvatarProps) {
  const finalBankName = bankName || account?.banco_nombre || account?.nombre || "Caja"
  const finalAccountColor = accountColor || account?.color || null
  const normalizedBankName = finalBankName.toLowerCase()

  const accountType = account?.tipo || (normalizedBankName.includes("caja") ? "caja" : "banco")
  const isCaja = accountType === "caja"

  // Check if it's a specific bank with dedicated logo
  const isCaixabank = normalizedBankName.includes("caixabank") || normalizedBankName.includes("caixa") || normalizedBankName.includes("la caixa")
  const isSabadell = normalizedBankName.includes("sabadell") || normalizedBankName.includes("banco sabadell") || normalizedBankName.includes("banc sabadell")
  const shouldShowLogo = !isCaja && (isCaixabank || isSabadell)

  // Logo base derivado de las props (sin efecto). El estado solo guarda el
  // override que aplica handleImageError al fallar la carga (.png -> .jpg ->
  // placeholder). Cuando cambia el banco, reseteamos el estado durante el
  // render comparando con el valor previo (patrón "You Might Not Need an Effect").
  const baseLogoSrc = isCaixabank
    ? "/bank-logos/caixabank.png"
    : isSabadell
      ? "/bank-logos/sabadell.png"
      : null

  const [logoSrc, setLogoSrc] = useState<string | null>(baseLogoSrc)
  const [prevBaseLogoSrc, setPrevBaseLogoSrc] = useState<string | null>(baseLogoSrc)
  if (baseLogoSrc !== prevBaseLogoSrc) {
    setPrevBaseLogoSrc(baseLogoSrc)
    setLogoSrc(baseLogoSrc)
  }

  const handleImageError = () => {
    if (!logoSrc) return

    if (isCaixabank) {
      if (logoSrc.endsWith(".png")) {
        setLogoSrc("/bank-logos/caixabank.jpg")
      } else {
        setLogoSrc("/placeholder-logo.png")
      }
    } else if (isSabadell) {
      if (logoSrc.endsWith(".png")) {
        setLogoSrc("/bank-logos/sabadell.jpg")
      } else {
        setLogoSrc("/placeholder-logo.png")
      }
    }
  }

  const iconClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-6 w-6"

  const fallbackIcon = isCaja ? (
    <PiggyBank className={iconClass} />
  ) : (
    <Landmark className={iconClass} />
  )

  const avatarClassName = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  const backgroundColor = finalAccountColor || "#334155"
  const backgroundStyle = { backgroundColor }

  return (
    <Avatar className={avatarClassName} style={backgroundStyle}>
      {shouldShowLogo && logoSrc && (
        <AvatarImage
          src={logoSrc}
          onError={handleImageError}
          alt={finalBankName}
          className="object-contain"
        />
      )}
      <AvatarFallback
        className="text-white font-semibold"
        style={backgroundStyle}
      >
        {fallbackIcon}
      </AvatarFallback>
    </Avatar>
  )
}
