"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

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

  const checkConnection = async () => {
    setChecking(true)
    const newStatus = { ...status, lastChecked: new Date().toLocaleString() }
    
    try {
      // Test basic connection with movimiento table
      const { error: dbError } = await supabase.from("movimiento").select("id").limit(1)
      newStatus.db = dbError ? `Error: ${dbError.message}` : "✅ Conectado"

      // Test perfil table (this is the problem table)
      try {
        const { error: perfilError } = await supabase.from("perfil").select("usuario_id").limit(1)
        newStatus.perfil = perfilError ? `❌ Error: ${perfilError.message}` : "✅ Conectado"
      } catch (err) {
        newStatus.perfil = `❌ Tabla no existe o error grave: ${err instanceof Error ? err.message : 'Error desconocido'}`
      }

      // Test membresia table for user permissions
      if (user) {
        try {
          const { error: membresiaError } = await supabase
            .from("membresia")
            .select("delegacion_id")
            .eq("usuario_id", user.id)
            .limit(1)
          newStatus.membresia = membresiaError ? `❌ Error: ${membresiaError.message}` : "✅ Conectado"
        } catch (err) {
          newStatus.membresia = `❌ Error: ${err instanceof Error ? err.message : 'Error desconocido'}`
        }
      } else {
        newStatus.membresia = "⚠️ Usuario no autenticado"
      }

      // Test delegacion table
      try {
        const { error: delegacionError } = await supabase.from("delegacion").select("id").limit(1)
        newStatus.delegacion = delegacionError ? `❌ Error: ${delegacionError.message}` : "✅ Conectado"
      } catch (err) {
        newStatus.delegacion = `❌ Error: ${err instanceof Error ? err.message : 'Error desconocido'}`
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
        <Button onClick={checkConnection} disabled={checking}>
          {checking ? <LoadingSpinner size="sm" className="mr-2" /> : null}
          Revisar estado
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Usuario</h2>
          <p className="text-sm text-muted-foreground">
            {user ? `${user.email} (${user.id})` : "No autenticado"}
          </p>
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
    </div>
  )
}
