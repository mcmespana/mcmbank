"use client"

import { AppLayout } from "@/components/app-layout"
import { TransactionManager } from "@/components/transactions/transaction-manager"

export default function TransaccionesPage() {
  return (
    <AppLayout>
      <TransactionManager />
    </AppLayout>
  )
}
