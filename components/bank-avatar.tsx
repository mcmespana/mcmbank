"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Banknote } from "lucide-react"
import type { Cuenta } from "@/lib/types/database"
import { useMemo, useState } from "react"

interface BankAvatarProps {
  bankName?: string
  accountColor?: string
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

export function BankAvatar({ bankName, accountColor, account, size = "md" }: BankAvatarProps) {
  const finalBankName = bankName || account?.banco_nombre || account?.nombre || "Caja"
  const finalAccountColor = accountColor || account?.color

  // Build asset base name: lowercase, remove diacritics and non-alphanumeric, remove spaces
  const assetBase = useMemo(() => {
    return finalBankName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  }, [finalBankName])

  const isCash = finalBankName.toLowerCase().includes("caja") || finalBankName.toLowerCase().includes("efectivo")

  // Get bank color
  const bankColor = Object.keys(BANK_COLORS).find((bank) => finalBankName.toLowerCase().includes(bank.toLowerCase()))
  const colorClass = bankColor ? BANK_COLORS[bankColor as keyof typeof BANK_COLORS] : BANK_COLORS.default

  // Generate initials
  const initials = finalBankName
    .split(" ")
    .map((word: string) => word.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase()

  // Try .png first, then .jpg, then placeholder
  const [logoSrc, setLogoSrc] = useState<string>(`/bank-logos/${assetBase}.png`)
  const handleImageError = () => {
    if (logoSrc.endsWith(".png")) {
      setLogoSrc(`/bank-logos/${assetBase}.jpg`)
    } else if (logoSrc.endsWith(`/${assetBase}.jpg`)) {
      setLogoSrc("/placeholder-logo.png")
    }
  }

  return (
    <div className="relative">
      <Avatar className={size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10"}>
        {!isCash && <AvatarImage src={logoSrc || "/placeholder.svg"} onError={handleImageError} alt={finalBankName} />}
        <AvatarFallback
          className="text-white font-semibold"
          style={{
            backgroundColor:
              finalAccountColor ||
              (bankColor ? BANK_COLORS[bankColor as keyof typeof BANK_COLORS].replace("bg-", "#") : "#64748b"),
          }}
        >
          {isCash ? (
            <Banknote className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
          ) : (
            <span className={size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"}>{initials}</span>
          )}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}
