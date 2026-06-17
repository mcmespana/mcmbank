"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
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

/**
 * Lista compacta agrupada por estado. Los estados sin propuestas no se
 * renderizan — antes era un kanban de columnas fijas que desperdiciaba
 * la mayor parte de la pantalla con columnas vacías.
 */
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
    return statusOrder
      .map((status) => ({
        status,
        proposals: proposals
          .filter((proposal) => proposal.estado === status)
          .sort((a, b) => b.votesCount - a.votesCount),
      }))
      .filter((group) => group.proposals.length > 0)
  }, [proposals, statusOrder])

  const hiddenCompleted =
    type === "idea" && !showCompleted
      ? proposals.filter((proposal) => proposal.estado === "hechisimo").length
      : 0

  const copy = IMPROVEMENT_PROPOSAL_BOARD_COPY[type]
  const emptyIcon = type === "idea" ? <Lightbulb className="h-6 w-6" /> : <Bug className="h-6 w-6" />

  if (loading && proposals.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-muted-foreground">
        <LoadingSpinner />
        <p className="text-sm">{copy.loading}</p>
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} icon={emptyIcon} />
    )
  }

  return (
    <div className="space-y-5">
      {refreshing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner className="h-3.5 w-3.5" size="sm" /> {copy.refreshing}
        </div>
      )}

      {grouped.map(({ status, proposals: groupProposals }) => {
        const config = IMPROVEMENT_PROPOSAL_STATUS_CONFIG[status]
        return (
          <div key={status} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  config.badgeClassName,
                )}
              >
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {config.description} · {groupProposals.length}
              </span>
            </div>
            <div className="space-y-2">
              {groupProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  statusConfig={config}
                  isAdmin={isAdmin}
                  disabled={updatingId === proposal.id}
                  voting={votingId === proposal.id}
                  onToggleVote={onToggleVote}
                  onCommentAdded={onCommentAdded}
                  hideStatusBadge
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
              ))}
            </div>
          </div>
        )
      })}

      {hiddenCompleted > 0 && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
          Hay {hiddenCompleted} propuesta{hiddenCompleted === 1 ? "" : "s"} en Hechísimo. Usa el botón
          &quot;Mostrar hechísimos&quot; para verlas.
        </div>
      )}
    </div>
  )
}
