"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCallStats, clearCallStats } from "@/hooks/use-debug-calls"

export function CallStatsViewer() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [autoRefresh, setAutoRefresh] = useState(true)

  const refreshStats = () => {
    setStats(getCallStats())
  }

  const clearStats = () => {
    clearCallStats()
    setStats({})
  }

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshStats, 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    refreshStats()
  }, [])

  const sortedStats = Object.entries(stats).sort(([, a], [, b]) => b - a)
  const totalCalls = Object.values(stats).reduce((sum, count) => sum + count, 0)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">📊 Stats de Llamadas a Hooks</h2>
        <div className="flex gap-2">
          <Button 
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "⏸️ Pausar" : "▶️ Auto"}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshStats}>
            🔄 Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={clearStats}>
            🗑️ Limpiar
          </Button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-muted rounded-md">
        <p className="text-lg font-bold">
          📈 Total de llamadas: <span className="text-red-600">{totalCalls}</span>
        </p>
        {totalCalls > 1000 && (
          <p className="text-red-600 font-semibold mt-2">
            🚨 ¡EXCESO DE LLAMADAS! Posible loop infinito detectado.
          </p>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-auto">
        {sortedStats.length === 0 ? (
          <p className="text-muted-foreground">No hay estadísticas disponibles</p>
        ) : (
          sortedStats.map(([hookName, count]) => {
            const isExcessive = count > 100
            const isWarning = count > 50
            
            return (
              <div 
                key={hookName} 
                className={`flex justify-between items-center p-3 rounded-md ${
                  isExcessive ? 'bg-red-50 border border-red-200' : 
                  isWarning ? 'bg-yellow-50 border border-yellow-200' : 
                  'bg-gray-50'
                }`}
              >
                <span className="font-medium">{hookName}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${
                    isExcessive ? 'text-red-600' : 
                    isWarning ? 'text-yellow-600' : 
                    'text-green-600'
                  }`}>
                    {count}
                  </span>
                  {isExcessive && <span className="text-red-600">🚨</span>}
                  {isWarning && !isExcessive && <span className="text-yellow-600">⚠️</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
