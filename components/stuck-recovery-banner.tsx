"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { forceConnectionReset } from "@/hooks/use-app-status"
import { nukeSupabaseStorageAndReload } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react"

// Detects when the app is stuck in a non-recoverable state and offers manual
// recovery. "Stuck" means: AuthProvider finished loading but user is still
// null after a grace period (likely cookie/storage desync) — OR user is set
// but data hooks haven't produced anything visible after a longer window.
//
// The banner triggers an automatic forceConnectionReset() once silently, then
// surfaces a visible "Recargar página" button as last resort.

const SILENT_RETRY_MS = 8000
const VISIBLE_BANNER_MS = 14000

export function StuckRecoveryBanner() {
  const { user, loading } = useAuth()
  const [showBanner, setShowBanner] = useState(false)
  const [autoTriedAt, setAutoTriedAt] = useState<number | null>(null)

  // Stuck detection: auth finished loading but no user present.
  useEffect(() => {
    if (loading) return
    if (user) {
      setShowBanner(false)
      setAutoTriedAt(null)
      return
    }

    // user=null + loading=false. Could be legitimately signed out (then
    // middleware redirects to /auth/login). On auth pages, hide the banner.
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/auth")) {
      return
    }

    // Schedule a silent auto-reset after grace period
    const silentTimer = setTimeout(() => {
      console.warn("[stuck-recovery] auth=false, no user — auto forceConnectionReset")
      setAutoTriedAt(Date.now())
      forceConnectionReset().catch((e) => console.error("[stuck-recovery] auto reset failed:", e))
    }, SILENT_RETRY_MS)

    // After longer window without recovery, show visible banner
    const visibleTimer = setTimeout(() => {
      console.warn("[stuck-recovery] still stuck after auto reset — surfacing banner")
      setShowBanner(true)
    }, VISIBLE_BANNER_MS)

    return () => {
      clearTimeout(silentTimer)
      clearTimeout(visibleTimer)
    }
  }, [loading, user])

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-500 text-yellow-950 shadow-lg border-b-2 border-yellow-700">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <strong>Conexión perdida.</strong> No conseguimos recuperar tu sesión automáticamente.
          {autoTriedAt && (
            <span className="opacity-75 ml-2 text-xs">
              (auto-reset @ {new Date(autoTriedAt).toLocaleTimeString()})
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => forceConnectionReset()}
          className="bg-yellow-950 text-yellow-50 hover:bg-yellow-900"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Reintentar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
          className="border-yellow-950 text-yellow-950 hover:bg-yellow-600"
        >
          Recargar página
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (confirm("Esto cerrará tu sesión y te pedirá iniciar sesión de nuevo. ¿Continuar?")) {
              nukeSupabaseStorageAndReload()
            }
          }}
          className="border-red-700 bg-red-100 text-red-900 hover:bg-red-200"
          title="Borra credenciales y recarga (último recurso)"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Sesión limpia
        </Button>
      </div>
    </div>
  )
}
