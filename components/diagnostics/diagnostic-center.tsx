"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { CallStatsViewer } from "@/components/debug/call-stats-viewer"
import { useAppStatus } from "@/hooks/use-app-status"
import { getMetrics, subscribe } from "@/lib/db/telemetry"

interface Status {
  db: string
  perfil: string
  membresia: string
  delegacion: string
  lastChecked: string | null
  env: Record<string, string | undefined>
}

export function DiagnosticCenter() {
  const { user } = useAuth()
  
  // App status (online/focused)
  const { isFocused, isOnline } = useAppStatus()
  const [metrics, setMetrics] = useState(getMetrics())
  
  const [status, setStatus] = useState<Status>({
    db: "No verificado",
    perfil: "No verificado",
    membresia: "No verificado", 
    delegacion: "No verificado",
    lastChecked: null,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  })
  const [checking, setChecking] = useState(false)

  // Subscribe to query metrics
  useEffect(() => {
    const unsub = subscribe(() => setMetrics(getMetrics()))
    return () => unsub()
  }, [])

  const checkConnection = async () => {
    setChecking(true)
    const newStatus = { ...status, lastChecked: new Date().toLocaleString() }
    
    try {
      // Test basic connection with movimiento table (with timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout después de 10 segundos")), 10000)
      })
      
      try {
        const queryPromise = supabase.from("movimiento").select("id").limit(1)
        const { error: dbError } = await Promise.race([queryPromise, timeoutPromise])
        newStatus.db = dbError ? `❌ Error: ${dbError.message}` : "✅ Conectado"
      } catch (err) {
        newStatus.db = `❌ Timeout o error: ${err instanceof Error ? err.message : 'Error desconocido'}`
      }

      // Test perfil table with timeout
      try {
        const perfilPromise = supabase.from("perfil").select("usuario_id").limit(1)
        const { error: perfilError } = await Promise.race([perfilPromise, timeoutPromise])
        newStatus.perfil = perfilError ? `❌ Error: ${perfilError.message}` : "✅ Conectado"
      } catch (err) {
        newStatus.perfil = `❌ Timeout o tabla no existe: ${err instanceof Error ? err.message : 'Error desconocido'}`
      }

      // Test membresia table for user permissions with timeout
      if (user) {
        try {
          const membresiaPromise = supabase
            .from("membresia")
            .select("delegacion_id")
            .eq("usuario_id", user.id)
            .limit(1)
          const { error: membresiaError } = await Promise.race([membresiaPromise, timeoutPromise])
          newStatus.membresia = membresiaError ? `❌ Error: ${membresiaError.message}` : "✅ Conectado"
        } catch (err) {
          newStatus.membresia = `❌ Timeout o error: ${err instanceof Error ? err.message : 'Error desconocido'}`
        }
      } else {
        newStatus.membresia = "⚠️ Usuario no autenticado"
      }

      // Test delegacion table with timeout
      try {
        const delegacionPromise = supabase.from("delegacion").select("id").limit(1)
        const { error: delegacionError } = await Promise.race([delegacionPromise, timeoutPromise])
        newStatus.delegacion = delegacionError ? `❌ Error: ${delegacionError.message}` : "✅ Conectado"
      } catch (err) {
        newStatus.delegacion = `❌ Timeout o error: ${err instanceof Error ? err.message : 'Error desconocido'}`
      }

      // Test complex query that typically hangs (movimiento with JOINs)
      if (user) {
        try {
          const complexPromise = supabase
            .from("movimiento")
            .select(`
              id,
              fecha,
              concepto,
              cuenta:cuenta_id (
                id,
                nombre,
                delegacion:delegacion_id (id, nombre)
              )
            `)
            .limit(5)
          const { error: complexError } = await Promise.race([complexPromise, timeoutPromise])
          newStatus.db += ` | JOINs: ${complexError ? '❌ Error' : '✅ OK'}`
        } catch (err) {
          newStatus.db += ` | JOINs: ❌ Timeout/Error`
        }
      }

    } catch (err) {
      newStatus.db = `❌ Error general: ${err instanceof Error ? err.message : 'Error desconocido'}`
    } finally {
      setStatus(newStatus)
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Centro de Diagnóstico</h1>
        <div className="flex gap-2">
          <Button onClick={checkConnection} disabled={checking}>
            {checking ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Revisar estado
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Usuario</h2>
          <p className="text-sm text-muted-foreground">
            {user ? `${user.email} (${user.id})` : "No autenticado"}
          </p>
          
          {/* Connection Status */}
          <div className="mt-3 p-3 bg-muted rounded-md">
            <h3 className="text-sm font-medium mb-2">Estado de Conexión</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span>Pestaña activa:</span>
                <span className={isFocused ? "text-green-600" : "text-red-600"}>
                  {isFocused ? "✅ Visible" : "❌ Oculto"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>Estado de red:</span>
                <span className={isOnline ? "text-green-600" : "text-red-600"}>
                  {isOnline ? "✅ Online" : "❌ Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Variables de Entorno</h2>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
{JSON.stringify(status.env, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Estado de las Tablas</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Conexión General (movimiento):</p>
              <p className="text-sm ml-4">{status.db}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Tabla Perfil (PROBLEMA CONOCIDO):</p>
              <p className="text-sm ml-4">{status.perfil}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Tabla Membresía:</p>
              <p className="text-sm ml-4">{status.membresia}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Tabla Delegación:</p>
              <p className="text-sm ml-4">{status.delegacion}</p>
            </div>
            {status.lastChecked && (
              <p className="text-xs text-muted-foreground mt-4">Última revisión: {status.lastChecked}</p>
            )}
          </div>
        </div>
      </Card>

      <CallStatsViewer />

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Métricas de Consultas (últimas {Math.min(metrics.length, 30)})</h2>
        <div className="text-xs text-muted-foreground">Etiqueta | Tabla | ms | estado</div>
        <div className="max-h-64 overflow-auto text-sm font-mono">
          {(metrics.slice(-30)).reverse().map((m, idx) => (
            <div key={idx} className="flex gap-3">
              <span>{m.label}</span>
              <span>{m.table || '-'}</span>
              <span>{m.ms}ms</span>
              <span className={m.status === 'ok' ? 'text-green-600' : m.status === 'timeout' ? 'text-orange-600' : 'text-red-600'}>{m.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
