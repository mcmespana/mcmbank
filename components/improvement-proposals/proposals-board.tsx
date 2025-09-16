"use client"

import { useMemo } from "react"
import { ProposalCard } from "./proposal-card"
import { IMPROVEMENT_PROPOSAL_STATUS_CONFIG } from "./status-config"
import {
  type ImprovementProposalWithAuthor,
  type ImprovementProposalStatus,
  IMPROVEMENT_PROPOSAL_STATUSES,
} from "@/lib/types/improvement-proposals"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { Lightbulb } from "lucide-react"

interface ProposalsBoardProps {
  proposals: ImprovementProposalWithAuthor[]
  loading?: boolean
  refreshing?: boolean
  showCompleted?: boolean
  isAdmin?: boolean
  onStatusChange?: (proposalId: string, status: ImprovementProposalStatus) => Promise<void>
  updatingId?: string | null
}

export function ProposalsBoard({
  proposals,
  loading = false,
  refreshing = false,
  showCompleted = false,
  isAdmin = false,
  onStatusChange,
  updatingId,
}: ProposalsBoardProps) {
  const statusOrder = useMemo(() => {
    return showCompleted
      ? IMPROVEMENT_PROPOSAL_STATUSES
      : IMPROVEMENT_PROPOSAL_STATUSES.filter((status) => status !== "hechisimo")
  }, [showCompleted])

  const grouped = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      proposals: proposals.filter((proposal) => proposal.estado === status),
    }))
  }, [proposals, statusOrder])

  const hiddenCompleted = !showCompleted
    ? proposals.filter((proposal) => proposal.estado === "hechisimo").length
    : 0

  if (loading && proposals.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/10 p-10 text-muted-foreground">
        <LoadingSpinner />
        <p>Cargando propuestas de mejora...</p>
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        title="Aún no hay propuestas de mejora"
        description="Sé la primera persona en compartir una idea para potenciar MCM Bank. ¡Queremos escucharte!"
        icon={<Lightbulb className="h-6 w-6" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner className="h-3.5 w-3.5" size="sm" /> Sincronizando ideas...
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div
          className={cn(
            "flex gap-6",
            statusOrder.length >= 3 ? "min-w-[960px]" : "min-w-full",
          )}
        >
          {grouped.map(({ status, proposals: columnProposals }) => {
            const config = IMPROVEMENT_PROPOSAL_STATUS_CONFIG[status]

            return (
              <div
                key={status}
                className="flex w-[260px] flex-shrink-0 flex-col gap-4 sm:w-[300px] lg:w-[340px] xl:w-[360px]"
              >
                <div
                  className={cn(
                    "rounded-3xl border border-border/50 bg-card/70 p-5 shadow-sm backdrop-blur-sm",
                    config.headerBackground,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                    <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {columnProposals.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {columnProposals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-5 text-center text-xs text-muted-foreground">
                      Aún no hay ideas en esta fase.
                    </div>
                  ) : (
                    columnProposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        statusConfig={config}
                        isAdmin={isAdmin}
                        disabled={updatingId === proposal.id}
                        onStatusChange={
                          onStatusChange
                            ? async (nextStatus) => {
                                try {
                                  await onStatusChange(proposal.id, nextStatus)
                                } catch (updateError) {
                                  console.error("Error updating proposal status", updateError)
                                }
                              }
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {hiddenCompleted > 0 && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 shadow-inner dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
          Hay {hiddenCompleted} propuesta{hiddenCompleted === 1 ? "" : "s"} celebrada{hiddenCompleted === 1 ? "" : "s"} en
          Hechísimo. Usa el filtro para verlas y celebrar los logros.
        </div>
      )}
    </div>
  )
}
