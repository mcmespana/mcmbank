import { AppLayout } from "@/components/app-layout"
import { DashboardSkeleton } from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <AppLayout>
      <DashboardSkeleton />
    </AppLayout>
  )
}
