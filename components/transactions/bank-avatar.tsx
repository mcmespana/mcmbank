"use client"

import { BankAvatar as BaseBankAvatar } from "@/components/bank-avatar"
import type { Cuenta } from "@/lib/types/database"

interface BankAvatarProps {
  account?: Cuenta
  size?: "sm" | "md" | "lg"
}

export function BankAvatar({ account, size = "md" }: BankAvatarProps) {
  return <BaseBankAvatar account={account} size={size} />
}
