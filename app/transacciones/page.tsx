"use client"

import { AppLayout } from "@/components/app-layout"
import { TransactionManager } from "@/components/transactions/transaction-manager"

export default function TransaccionesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-2 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/30" />
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
            Movimientos
          </h1>
        </div>
        <TransactionManager />
      </div>
    </AppLayout>
  )
}
