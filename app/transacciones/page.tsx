"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { TransactionManager } from "@/components/transactions/transaction-manager"

export default function TransaccionesPage() {
  const [transactionCount, setTransactionCount] = useState<number>(0)

  return (
    <AppLayout transactionCount={transactionCount}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground">Categoriza los ingresos o gastos en el banco y del efectivo</p>
        </div>
        <TransactionManager onTransactionCountChange={setTransactionCount} />
      </div>
    </AppLayout>
  )
}
