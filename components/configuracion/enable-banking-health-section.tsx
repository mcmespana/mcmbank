"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Wifi } from "lucide-react"

type HealthResult = {
  appIdConfigured: boolean
  privateKeyConfigured: boolean
  redirectUrlConfigured: boolean
  cronSecretConfigured: boolean
  jwtSigning: "ok" | "failed"
  jwtError?: string
  privateKeyFingerprint?: string
}

const FIELD_LABELS: Record<keyof HealthResult, string> = {
  appIdConfigured: "ENABLE_BANKING_APP_ID configurado",
  privateKeyConfigured: "ENABLE_BANKING_PRIVATE_KEY configurado",
  redirectUrlConfigured: "ENABLE_BANKING_REDIRECT_URL configurado",
  cronSecretConfigured: "CRON_SECRET configurado",
  jwtSigning: "Firma de JWT (clave privada válida)",
  jwtError: "Detalle del error",
  privateKeyFingerprint: "Fingerprint de la clave privada",
}

/**
 * Diagnóstico de configuración de Enable Banking (docs/ENABLE_BANKING.md).
 * Solo booleanos y un fingerprint — nunca secretos reales.
 */
export function EnableBankingHealthSection() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/bank-sync/health")
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error || "No se pudo comprobar la configuración")
        return
      }
      setResult(body as HealthResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo comprobar la configuración")
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !result) {
      runCheck()
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-4 w-4" />
            Diagnóstico Enable Banking
          </CardTitle>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando configuración…
            </p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {result && !loading && (
            <div className="space-y-1.5 text-sm">
              {(Object.keys(FIELD_LABELS) as (keyof HealthResult)[]).map((key) => {
                const value = result[key]
                if (value === undefined) return null
                const isBooleanField = typeof value === "boolean"
                const ok = isBooleanField ? value : value === "ok"
                return (
                  <div key={key} className="flex items-center gap-2">
                    {isBooleanField || key === "jwtSigning" ? (
                      ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                      )
                    ) : null}
                    <span className="text-muted-foreground">{FIELD_LABELS[key]}:</span>
                    <span className="font-mono">{String(value)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={runCheck} disabled={loading}>
            Volver a comprobar
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
