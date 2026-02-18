"use client"

import { useAppStatus } from "@/hooks/use-app-status"

// Lightweight background monitor that subscribes to online/focus events.
// Session refresh and data revalidation are handled centrally by useAppStatus.
// This component only needs to exist so useAppStatus() is called at the provider level.
export function ConnectionMonitor() {
  useAppStatus()
  return null
}
