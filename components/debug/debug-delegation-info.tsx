"use client"

import { useDelegationContext } from "@/contexts/delegation-context"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface DebugDelegationInfoProps {
  movements?: any[]
  accounts?: any[]
}

export function DebugDelegationInfo({ movements = [], accounts = [] }: DebugDelegationInfoProps) {
  const { selectedDelegation, getCurrentDelegation, delegations } = useDelegationContext()
  const currentDelegation = getCurrentDelegation()

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const uniqueAccountDelegations = [...new Set(movements.map(m => {
    const account = accounts.find(a => a.id === m.cuenta_id)
    return account?.delegacion_id
  }).filter(Boolean))]

  return (
    <Card className="p-4 mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
      <div className="text-sm space-y-2">
        <div className="font-semibold text-blue-800 dark:text-blue-200">
          🔍 Debug: Información de Delegación
        </div>
        
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

        <div className="text-xs text-blue-600 dark:text-blue-400">
          ✅ = Delegación seleccionada | ⚠️ Si ves múltiples badges, hay un problema de filtrado
        </div>
      </div>
    </Card>
  )
}
