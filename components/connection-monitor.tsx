"use client"

import { useAppStatus } from "@/hooks/use-app-status"

export function ConnectionMonitor() {
  // Simple tab visibility monitoring without database queries
  const { isFocused } = useAppStatus()
  
  // The useAppStatus hook already logs visibility changes internally.
  // This component can remain for future extensions or if specific side effects are needed here.
  // For now, it just ensures the hook is active at a high level.
  

  // This component doesn't render anything visible
  // It just monitors tab visibility in the background
  return null
}
