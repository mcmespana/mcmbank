"use client"

import { useAppStatus } from "@/hooks/use-app-status"

// Mounts the visibilitychange listener that refreshes auth and fires
// appStatusEmitter so all hooks revalidate when the tab regains focus.
export function ConnectionMonitor() {
  useAppStatus()
  return null
}
