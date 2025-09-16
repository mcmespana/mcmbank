"use client"

import { AppLayout } from "@/components/app-layout"
import { ImprovementProposalsBoard } from "@/components/proposals/improvement-proposals-board"

export default function ImprovementProposalsPage() {
  return (
    <AppLayout>
      <ImprovementProposalsBoard />
    </AppLayout>
  )
}

