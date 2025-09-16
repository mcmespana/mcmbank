"use client"

import { useDelegationContext } from "@/contexts/delegation-context"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { isDebugEnabled } from "@/lib/utils/debug"
import { useEffect, useState } from "react"

interface DebugDelegationInfoProps {
  movements?: any[]
  accounts?: any[]
}

export function DebugDelegationInfo({ movements = [], accounts = [] }: DebugDelegationInfoProps) {
  const { selectedDelegation, getCurrentDelegation, delegations } = useDelegationContext()
  const currentDelegation = getCurrentDelegation()

  // Solo mostrar cuando debug está habilitado
  if (!isDebugEnabled) {
    return null
  }

  const [expanded, setExpanded] = useState(false)

  // Persistir estado en localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("debugDelegationInfoExpanded")
      if (saved !== null) setExpanded(saved === "1")
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("debugDelegationInfoExpanded", expanded ? "1" : "0")
    } catch {}
  }, [expanded])

  const uniqueAccountDelegations = [...new Set(movements.map(m => {
    const account = accounts.find(a => a.id === m.cuenta_id)
    return account?.delegacion_id
  }).filter(Boolean))]

  return (
    <div className="mb-3">
      {/* Toggle compacto */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border bg-muted hover:bg-muted/80 text-muted-foreground"
        title={expanded ? "Ocultar debug" : "Mostrar debug"}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Debug delegación
        <span className="ml-1 opacity-70">{expanded ? "(ocultar)" : "(ver)"}</span>
      </button>

      {expanded && (
        <Card className="mt-2 p-4 border border-muted-foreground/20 bg-background">
          <div className="text-sm space-y-2">
            <div className="font-medium text-foreground">🔍 Debug: Información de Delegación</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div>
                <strong>Delegación Seleccionada:</strong><br />
                ID: <Badge variant="outline">{selectedDelegation || 'null'}</Badge><br />
                Nombre: <Badge variant="outline">{currentDelegation?.nombre || 'No encontrada'}</Badge>
              </div>
              
              <div>
                <strong>Transacciones Visibles:</strong><br />
                Total: <Badge variant="outline">{movements.length}</Badge><br />
                Delegaciones únicas: <Badge variant="outline">{uniqueAccountDelegations.length}</Badge>
              </div>
            </div>

            <div>
              <strong>Delegaciones en transacciones:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {uniqueAccountDelegations.map(delegId => {
                  const delegation = delegations.find(d => d.id === delegId)
                  return (
                    <Badge 
                      key={delegId} 
                      variant={delegId === selectedDelegation ? "default" : "secondary"}
                      className={delegId === selectedDelegation ? "bg-green-600" : ""}
                    >
                      {delegation?.nombre || delegId}
                    </Badge>
                  )
                })}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              ✅ = Delegación seleccionada | ⚠️ Si ves múltiples badges, hay un problema de filtrado
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
