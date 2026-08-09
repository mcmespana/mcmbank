"use client"

import { useCallback, useEffect, useState } from "react"
import { Plug, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface ConexionMcp {
  client_id: string
  usuario_id: string
  aplicacion: string
  usuario: string
  scope: string
  conectado_en: string
  ultimo_uso_en: string | null
}

/**
 * Aplicaciones conectadas al servidor MCP por OAuth (el conector de claude.ai,
 * normalmente), con la opción de retirarles el acceso.
 *
 * La pantalla de consentimiento promete que se puede revocar cuando se quiera;
 * esta sección es donde se cumple.
 */
export function ConexionesMcpSection() {
  const [conexiones, setConexiones] = useState<ConexionMcp[]>([])
  const [cargando, setCargando] = useState(true)
  const [revocando, setRevocando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/admin/conexiones-mcp")
      const datos = await res.json()
      if (!res.ok) throw new Error(datos?.error || "No se pudieron cargar las conexiones")
      setConexiones(datos.conexiones ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las conexiones")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const revocar = async (conexion: ConexionMcp) => {
    const clave = `${conexion.client_id}::${conexion.usuario_id}`
    setRevocando(clave)
    try {
      const res = await fetch(
        `/api/admin/conexiones-mcp?client_id=${encodeURIComponent(conexion.client_id)}&usuario_id=${encodeURIComponent(conexion.usuario_id)}`,
        { method: "DELETE" },
      )
      const datos = await res.json()
      if (!res.ok) throw new Error(datos?.error || "No se pudo retirar el acceso")
      toast.success(`${conexion.aplicacion} ya no tiene acceso`)
      await cargar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo retirar el acceso")
    } finally {
      setRevocando(null)
    }
  }

  const formatear = (fecha: string | null) =>
    fecha
      ? new Date(fecha).toLocaleString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4" />
              Conexiones con asistentes (MCP)
            </CardTitle>
            <CardDescription>
              Aplicaciones que pueden consultar y modificar la tesorería en nombre de una persona de
              la oficina técnica.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
            <span className="sr-only">Actualizar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {cargando ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : conexiones.length === 0 ? (
          <EmptyState
            icon={<Plug className="h-5 w-5" />}
            title="Ninguna aplicación conectada"
            description="Cuando alguien añada MCM Bank como conector en Claude, aparecerá aquí."
          />
        ) : (
          <ul className="divide-y">
            {conexiones.map((conexion) => {
              const clave = `${conexion.client_id}::${conexion.usuario_id}`
              return (
                <li key={clave} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conexion.aplicacion}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      Autorizada por {conexion.usuario}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Conectada el {formatear(conexion.conectado_en)} · Último uso:{" "}
                      {formatear(conexion.ultimo_uso_en)}
                      {conexion.scope.includes("mcm:write") ? " · puede modificar" : " · solo lectura"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revocar(conexion)}
                    disabled={revocando === clave}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {revocando === clave ? "Retirando…" : "Retirar acceso"}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
