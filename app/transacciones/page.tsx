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
          <h1 className="text-3xl font-bold tracking-tight">Transacciones</h1>
          <p className="text-muted-foreground">Gestiona todos los movimientos de tu delegación</p>
        </div>
        <TransactionManager onTransactionCountChange={setTransactionCount} />
      </div>
    </AppLayout>
  )
}
