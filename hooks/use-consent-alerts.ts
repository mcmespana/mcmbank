"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

/**
 * Umbral (en días) por debajo del cual avisamos de que el consentimiento PSD2
 * de una cuenta conectada está a punto de caducar y hay que renovarlo.
 */
export const CONSENT_WARNING_DAYS = 20

export interface ConsentAlert {
  cuentaId: string
  cuentaNombre: string
  bancoNombre: string | null
  consentValidUntil: string
  /** Días enteros que faltan para caducar (negativo si ya caducó). */
  diasRestantes: number
  expirado: boolean
  estado: string | null
}

interface UseConsentAlertsResult {
  alerts: ConsentAlert[]
  loading: boolean
}

/**
 * Devuelve las cuentas conectadas (Enable Banking) de la delegación cuyo
 * consentimiento ha caducado o caduca en menos de `CONSENT_WARNING_DAYS` días.
 * Pensado para mostrar un aviso de renovación en la home del gestor central.
 */
export function useConsentAlerts(delegacionId: string | null): UseConsentAlertsResult {
  const [alerts, setAlerts] = useState<ConsentAlert[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    if (!delegacionId) {
      setAlerts([])
      setLoading(false)
      return
    }

    setLoading(true)

    ;(async () => {
      const { data, error } = await (supabase as any)
        .from("cuenta")
        .select(
          "id, nombre, banco_nombre, banco_conexion:banco_conexion_id ( estado, consent_valid_until )",
        )
        .eq("delegacion_id", delegacionId)
        .eq("sync_enabled", true)
        .not("banco_conexion_id", "is", null)

      if (!mounted) return

      if (error) {
        console.error("useConsentAlerts: error fetching consent info", error)
        setAlerts([])
        setLoading(false)
        return
      }

      const now = Date.now()
      const result: ConsentAlert[] = []

      for (const c of data || []) {
        const conn = Array.isArray(c.banco_conexion) ? c.banco_conexion[0] : c.banco_conexion
        if (!conn?.consent_valid_until) continue

        const until = new Date(conn.consent_valid_until).getTime()
        if (Number.isNaN(until)) continue

        const diasRestantes = Math.ceil((until - now) / 86_400_000)
        const expirado =
          until < now || conn.estado === "expirada" || conn.estado === "revocada"

        if (expirado || diasRestantes <= CONSENT_WARNING_DAYS) {
          result.push({
            cuentaId: c.id,
            cuentaNombre: c.nombre,
            bancoNombre: c.banco_nombre ?? null,
            consentValidUntil: conn.consent_valid_until,
            diasRestantes,
            expirado,
            estado: conn.estado ?? null,
          })
        }
      }

      // Lo más urgente primero (menos días / ya caducado arriba).
      result.sort((a, b) => a.diasRestantes - b.diasRestantes)

      setAlerts(result)
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [delegacionId])

  return { alerts, loading }
}

export default useConsentAlerts
