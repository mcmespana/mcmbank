"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface Status {
  db: string
  lastChecked: string | null
  env: Record<string, string | undefined>
}

export function DiagnosticCenter() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>({
    db: "No verificado",
    lastChecked: null,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  })
  const [checking, setChecking] = useState(false)

  const checkConnection = async () => {
    setChecking(true)
    try {
      const { error } = await supabase.from("movimiento").select("id").limit(1)
      setStatus({
        env: status.env,
        lastChecked: new Date().toLocaleString(),
        db: error ? `Error: ${error.message}` : "Conectado",
      })
    } catch (err) {
      setStatus({
        env: status.env,
        lastChecked: new Date().toLocaleString(),
        db: err instanceof Error ? `Error: ${err.message}` : "Error desconocido",
      })
    } finally {
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
          <h2 className="text-xl font-semibold mb-2">Base de Datos</h2>
          <p className="text-sm">
            Estado: <span className="font-medium">{status.db}</span>
          </p>
          {status.lastChecked && (
            <p className="text-xs text-muted-foreground">Última revisión: {status.lastChecked}</p>
          )}
        </div>
      </Card>
    </div>
  )
}
