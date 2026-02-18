"use client"

import { useMemo } from "react"
import { ProposalCard } from "./proposal-card"
import {
  IMPROVEMENT_PROPOSAL_STATUS_CONFIG,
  IMPROVEMENT_PROPOSAL_BOARD_COPY,
} from "./status-config"
import {
  type ImprovementProposalWithAuthor,
  type ImprovementProposalStatus,
  type ImprovementProposalType,
  IMPROVEMENT_PROPOSAL_STATUS_FLOW,
} from "@/lib/types/improvement-proposals"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { Lightbulb, Bug } from "lucide-react"

interface ProposalsBoardProps {
  type: ImprovementProposalType
  proposals: ImprovementProposalWithAuthor[]
  loading?: boolean
  refreshing?: boolean
  showCompleted?: boolean
  isAdmin?: boolean
  onStatusChange?: (proposalId: string, status: ImprovementProposalStatus) => Promise<void>
  updatingId?: string | null
  onToggleVote?: (proposalId: string) => Promise<void>
  votingId?: string | null
  onCommentAdded?: (proposalId: string) => void
}

export function ProposalsBoard({
  type,
  proposals,
  loading = false,
  refreshing = false,
  showCompleted = false,
  isAdmin = false,
  onStatusChange,
  updatingId,
  onToggleVote,
  votingId,
  onCommentAdded,
}: ProposalsBoardProps) {
  const statusOrder = useMemo(() => {
    const flow = IMPROVEMENT_PROPOSAL_STATUS_FLOW[type]
    if (type === "idea") {
      return showCompleted ? flow : flow.filter((status) => status !== "hechisimo")
    }
    return flow
  }, [showCompleted, type])

  const grouped = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      proposals: proposals.filter((proposal) => proposal.estado === status),
    }))
  }, [proposals, statusOrder])

  const hiddenCompleted =
    type === "idea" && !showCompleted
      ? proposals.filter((proposal) => proposal.estado === "hechisimo").length
      : 0

  const copy = IMPROVEMENT_PROPOSAL_BOARD_COPY[type]
  const emptyIcon = type === "idea" ? <Lightbulb className="h-6 w-6" /> : <Bug className="h-6 w-6" />

  if (loading && proposals.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/10 p-10 text-muted-foreground">
        <LoadingSpinner />
        <p>{copy.loading}</p>
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        title={copy.emptyTitle}
        description={copy.emptyDescription}
        icon={emptyIcon}
      />
    )
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner className="h-3.5 w-3.5" size="sm" /> {copy.refreshing}
        </div>
      )}

      <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
        <div
          className={cn(
            "flex gap-4 sm:gap-6",
            statusOrder.length >= 3 ? "min-w-[720px] sm:min-w-[960px]" : "min-w-full",
          )}
        >
          {grouped.map(({ status, proposals: columnProposals }) => {
            const config = IMPROVEMENT_PROPOSAL_STATUS_CONFIG[status]

            return (
              <div
                key={status}
                className="flex w-[220px] flex-shrink-0 flex-col gap-4 sm:w-[300px] lg:w-[340px] xl:w-[360px]"
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
                      {copy.emptyColumn}
                    </div>
                  ) : (
                    columnProposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        statusConfig={config}
                        isAdmin={isAdmin}
                        disabled={updatingId === proposal.id}
                        voting={votingId === proposal.id}
                        onToggleVote={onToggleVote}
                        onCommentAdded={onCommentAdded}
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
