"use client"

import { AppLayout } from "@/components/app-layout"
import { ImprovementProposalsPanel } from "@/components/improvement-proposals/proposals-panel"

export default function PropuestasPage() {
  return (
    <AppLayout>
      <ImprovementProposalsPanel />
    </AppLayout>
  )
}
