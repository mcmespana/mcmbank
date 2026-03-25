"use client"

// ConnectionMonitor previously did redundant auth refreshes and warm-up queries
// on every tab focus. This work is now handled by use-app-status.ts which:
// 1. Awaits refreshSession() before any hooks fire queries
// 2. Fires all revalidation listeners synchronously for React 18 batching
//
// The redundant calls here (getSession + refreshSession + 2 warm-up queries)
// were competing with the 7 hook revalidation queries for navigator.locks,
// contributing to the tab-switch freeze.
export function ConnectionMonitor() {
  return null
}
