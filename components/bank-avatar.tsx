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

  const wrapperSizeClass = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-16 w-16" : "h-12 w-12"
  const avatarSizeClass = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11"
  const paddingClass = size === "sm" ? "p-[2px]" : size === "lg" ? "p-[6px]" : "p-[4px]"
  const iconSizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5"

  const gradientClass = isCashAccount
    ? "from-amber-300 via-orange-400 to-amber-500"
    : "from-sky-400 via-blue-500 to-indigo-600"

  const glowClass = isCashAccount
    ? "from-amber-200/70 via-orange-200/60 to-amber-300/70"
    : "from-sky-300/70 via-blue-300/60 to-indigo-400/70"

  return (
    <div className={cn("relative inline-flex items-center justify-center", wrapperSizeClass)}>
      <div className={cn("absolute inset-0 -z-10 rounded-full blur-lg opacity-75 bg-gradient-to-br", glowClass)} />
      <div
        className={cn(
          "relative inline-flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br shadow-[0_16px_40px_-18px_rgba(15,23,42,0.55)]",
          gradientClass,
          paddingClass,
        )}
      >
        <Avatar
          className={cn(
            "relative h-full w-full overflow-hidden rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-inset ring-white/70",
            avatarSizeClass,
          )}
        >
          {shouldShowLogo && logoSrc ? (
            <AvatarImage
              src={logoSrc}
              onError={handleImageError}
              alt={finalBankName}
              className="h-full w-full rounded-full bg-white object-contain p-1"
            />
          ) : null}
          <AvatarFallback
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white",
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
      </div>
    </div>
  )
}
