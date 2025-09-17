"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Cuenta } from "@/lib/types/database"
import { Landmark, PiggyBank } from "lucide-react"
import { useMemo, useState } from "react"

interface BankAvatarProps {
  bankName?: string
  accountColor?: string
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

const BANK_FALLBACK_COLORS = {
  BBVA: "#2563eb",
  Santander: "#dc2626",
  CaixaBank: "#1e3a8a",
  Bankia: "#ea580c",
  ING: "#f97316",
  Openbank: "#16a34a",
  Revolut: "#7c3aed",
  N26: "#0891b2",
  Sabadell: "#3b82f6",
  "Banco Sabadell": "#3b82f6",
  Unicaja: "#047857",
  Kutxabank: "#1d4ed8",
  Bankinter: "#c2410c",
  Abanca: "#1e40af",
  Cajamar: "#065f46",
  Liberbank: "#6d28d9",
  "Eurocaja Rural": "#16a34a",
  Caja: "#d97706",
  default: "#64748b",
} as const

const AVATAR_SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const

const ICON_SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const

export function BankAvatar({ bankName, accountColor, account, size = "md" }: BankAvatarProps) {
  const finalBankName = bankName || account?.banco_nombre || account?.nombre || "Caja"
  const normalizedBankName = finalBankName.toLowerCase()

  const isCajaByType = account?.tipo === "caja"
  const isCajaByName = normalizedBankName.includes("caja") || normalizedBankName.includes("efectivo")
  const isCaja = isCajaByType || isCajaByName

  const isCaixabank =
    normalizedBankName.includes("caixabank") ||
    normalizedBankName.includes("caixa") ||
    normalizedBankName.includes("la caixa")

  const isSabadell =
    normalizedBankName.includes("sabadell") ||
    normalizedBankName.includes("banco sabadell") ||
    normalizedBankName.includes("banc sabadell")

  const shouldDisplayLogo = isCaixabank || isSabadell

  const fallbackColor = useMemo(() => {
    if (accountColor) return accountColor
    if (account?.color) return account.color

    const bankKey = Object.keys(BANK_FALLBACK_COLORS).find((bank) =>
      normalizedBankName.includes(bank.toLowerCase()),
    )

    if (bankKey) {
      return BANK_FALLBACK_COLORS[bankKey as keyof typeof BANK_FALLBACK_COLORS]
    }

    return BANK_FALLBACK_COLORS.default
  }, [accountColor, account?.color, normalizedBankName])

  const [logoSrc, setLogoSrc] = useState<string | null>(() => {
    if (isCaixabank) return "/bank-logos/caixabank.png"
    if (isSabadell) return "/bank-logos/sabadell.png"
    return null
  })

  const handleImageError = () => {
    if (!logoSrc) return

    if (logoSrc.endsWith(".png")) {
      setLogoSrc(logoSrc.replace(".png", ".jpg"))
    } else {
      setLogoSrc(null)
    }
  }

  const IconComponent = isCaja ? PiggyBank : Landmark

  return (
    <Avatar className={AVATAR_SIZES[size]} style={{ backgroundColor: fallbackColor }}>
      {shouldDisplayLogo && logoSrc && (
        <AvatarImage
          src={logoSrc}
          alt={finalBankName}
          onError={handleImageError}
          className="object-contain p-1"
        />
      )}
      <AvatarFallback
        className="flex items-center justify-center text-white"
        style={{ backgroundColor: fallbackColor }}
      >
        <IconComponent className={ICON_SIZES[size]} aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}
