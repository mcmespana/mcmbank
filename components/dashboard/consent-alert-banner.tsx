"use client"

import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import { useConsentAlerts, type ConsentAlert } from "@/hooks/use-consent-alerts"
import { useLocalStorageState } from "@/hooks/use-local-storage"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Solo quienes pueden renovar la conexión ven el aviso.
const ROLES_GESTION = ["gestor_central", "tesorero"]

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function textoEstado(a: ConsentAlert): string {
  if (a.expirado) return "consentimiento caducado"
  if (a.diasRestantes <= 0) return "caduca hoy"
  if (a.diasRestantes === 1) return "caduca mañana"
  return `caduca en ${a.diasRestantes} días`
}

export function ConsentAlertBanner() {
  const { selectedDelegation } = useDelegationContext()
  const { role } = useDelegationRole(selectedDelegation)
  const { alerts } = useConsentAlerts(selectedDelegation)
  // Se puede ocultar, pero reaparece al día siguiente: la renovación es importante.
  const [dismissedOn, setDismissedOn] = useLocalStorageState<string | null>(
    "mcmbank-consent-alert-dismissed",
    null,
  )

  if (!role || !ROLES_GESTION.includes(role)) return null
  if (alerts.length === 0) return null
  if (dismissedOn === hoyISO()) return null

  const hayCaducados = alerts.some((a) => a.expirado)

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 sm:p-5 shadow-sm",
        hayCaducados
          ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/60 dark:border-red-900 dark:from-red-950/40 dark:to-red-900/20"
          : "border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:border-amber-900 dark:from-amber-950/40 dark:to-amber-900/20",
      )}
      role="alert"
    >
      <button
        type="button"
        onClick={() => setDismissedOn(hoyISO())}
        aria-label="Ocultar aviso por hoy"
        className={cn(
          "absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          hayCaducados
            ? "text-red-500 hover:bg-red-200/50 dark:hover:bg-red-900/40"
            : "text-amber-600 hover:bg-amber-200/50 dark:hover:bg-amber-900/40",
        )}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            hayCaducados
              ? "bg-red-500/15 text-red-600 dark:text-red-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3
              className={cn(
                "font-semibold leading-tight",
                hayCaducados
                  ? "text-red-800 dark:text-red-200"
                  : "text-amber-800 dark:text-amber-200",
              )}
            >
              {hayCaducados
                ? "Conexión bancaria caducada"
                : "Renovación de conexión bancaria pendiente"}
            </h3>
            <p
              className={cn(
                "text-sm",
                hayCaducados
                  ? "text-red-700/90 dark:text-red-300/90"
                  : "text-amber-700/90 dark:text-amber-300/90",
              )}
            >
              {hayCaducados
                ? "Una o más cuentas han dejado de sincronizar automáticamente. Renueva el consentimiento para reanudar la importación de movimientos."
                : "El consentimiento de banca abierta caduca pronto. Renuévalo para que la sincronización diaria no se interrumpa."}
            </p>
          </div>

          <ul className="space-y-1">
            {alerts.map((a) => (
              <li
                key={a.cuentaId}
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm",
                  hayCaducados
                    ? "text-red-800 dark:text-red-200"
                    : "text-amber-800 dark:text-amber-200",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    a.expirado ? "bg-red-500" : "bg-amber-500",
                  )}
                />
                <span className="font-medium">{a.cuentaNombre}</span>
                {a.bancoNombre && (
                  <span className="text-muted-foreground">· {a.bancoNombre}</span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    a.expirado
                      ? "bg-red-500/15 text-red-700 dark:text-red-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {textoEstado(a)}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-1">
            <Button
              asChild
              size="sm"
              className={cn(
                hayCaducados
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white",
              )}
            >
              <Link href="/cuentas">Renovar conexión</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsentAlertBanner
