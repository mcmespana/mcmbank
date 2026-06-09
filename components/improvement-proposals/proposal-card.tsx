"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  type ImprovementProposalStatus,
  IMPROVEMENT_PROPOSAL_STATUS_LABELS,
  type ImprovementProposalWithAuthor,
  IMPROVEMENT_PROPOSAL_STATUS_FLOW,
} from "@/lib/types/improvement-proposals"
import type { ImprovementProposalStatusVisualConfig } from "./status-config"
import { MessageCircle, ThumbsUp } from "lucide-react"
import { ProposalCommentsDialog } from "./proposal-comments-dialog"
import { formatRelativeDate } from "./utils"

interface ProposalCardProps {
  proposal: ImprovementProposalWithAuthor
  statusConfig: ImprovementProposalStatusVisualConfig
  onStatusChange?: (status: ImprovementProposalStatus) => void
  onToggleVote?: (proposalId: string) => Promise<void>
  onCommentAdded?: (proposalId: string) => void
  isAdmin?: boolean
  disabled?: boolean
  voting?: boolean
  /** Oculta el badge de estado (cuando la card ya está bajo una cabecera de grupo) */
  hideStatusBadge?: boolean
}

export function ProposalCard({
  proposal,
  statusConfig,
  onStatusChange,
  onToggleVote,
  onCommentAdded,
  isAdmin = false,
  disabled = false,
  voting = false,
  hideStatusBadge = false,
}: ProposalCardProps) {
  const createdAgo = useMemo(() => formatRelativeDate(proposal.creado_en), [proposal.creado_en])
  const statusOptions = useMemo(
    () => IMPROVEMENT_PROPOSAL_STATUS_FLOW[proposal.tipo],
    [proposal.tipo],
  )
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isIdea = proposal.tipo === "idea"
  const isLongText = !!proposal.descripcion && proposal.descripcion.length > 160

  const voteTitle = isIdea
    ? proposal.userHasVoted
      ? "Apoyada — click para retirar tu apoyo"
      : "Apoyar idea"
    : proposal.userHasVoted
      ? "Confirmado — click para retirar"
      : "También me pasa"

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm transition-colors hover:border-border">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold leading-tight text-foreground">{proposal.titulo}</h3>
            {!hideStatusBadge && (
              <Badge
                className={cn(
                  "border px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                  statusConfig.badgeClassName,
                )}
              >
                {statusConfig.label}
              </Badge>
            )}
          </div>

          {proposal.descripcion && (
            <p
              className={cn(
                "whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground",
                !expanded && isLongText && "line-clamp-2",
              )}
            >
              {proposal.descripcion}
            </p>
          )}
          {isLongText && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            {proposal.authorName}
            {createdAgo && <> · {createdAgo}</>}
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={proposal.userHasVoted ? "default" : "outline"}
              size="sm"
              disabled={disabled || voting || !onToggleVote}
              onClick={() => void onToggleVote?.(proposal.id)}
              title={voteTitle}
              className={cn(
                "h-7 gap-1 rounded-full px-2.5 text-xs",
                proposal.userHasVoted &&
                  (isIdea
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-rose-600 text-white hover:bg-rose-500"),
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {proposal.votesCount}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommentsOpen(true)}
              title="Comentarios"
              className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {proposal.commentsCount}
            </Button>
          </div>

          {isAdmin && onStatusChange && (
            <Select
              value={proposal.estado}
              onValueChange={(value) => onStatusChange(value as ImprovementProposalStatus)}
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-[150px] rounded-lg border-border/60 bg-background/80 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status} className="text-sm">
                    {IMPROVEMENT_PROPOSAL_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <ProposalCommentsDialog
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        proposal={proposal}
        onCommentAdded={() => onCommentAdded?.(proposal.id)}
      />
    </div>
  )
}
