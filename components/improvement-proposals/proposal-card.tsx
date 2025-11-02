"use client"

import { useMemo, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  type ImprovementProposalStatus,
  IMPROVEMENT_PROPOSAL_STATUS_LABELS,
  type ImprovementProposalWithAuthor,
  IMPROVEMENT_PROPOSAL_STATUS_FLOW,
} from "@/lib/types/improvement-proposals"
import type { ImprovementProposalStatusVisualConfig } from "./status-config"
import { Clock, MessageCircle, ThumbsUp } from "lucide-react"
import { ProposalCommentsDialog } from "./proposal-comments-dialog"
import { formatRelativeDate, getInitials } from "./utils"

interface ProposalCardProps {
  proposal: ImprovementProposalWithAuthor
  statusConfig: ImprovementProposalStatusVisualConfig
  onStatusChange?: (status: ImprovementProposalStatus) => void
  onToggleVote?: (proposalId: string) => Promise<void>
  onCommentAdded?: (proposalId: string) => void
  isAdmin?: boolean
  disabled?: boolean
  voting?: boolean
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
}: ProposalCardProps) {
  const createdAgo = useMemo(() => formatRelativeDate(proposal.creado_en), [proposal.creado_en])
  const updatedAgo = useMemo(() => formatRelativeDate(proposal.actualizado_en), [proposal.actualizado_en])
  const statusOptions = useMemo(
    () => IMPROVEMENT_PROPOSAL_STATUS_FLOW[proposal.tipo],
    [proposal.tipo],
  )
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isIdea = proposal.tipo === "idea"
  const typeLabel = isIdea ? "Idea" : "Error"
  const isLongText = proposal.descripcion && proposal.descripcion.length > 200
  const voteLabel = isIdea
    ? proposal.userHasVoted
      ? "Apoyada"
      : "Apoyar idea"
    : proposal.userHasVoted
      ? "Confirmado"
      : "También me pasa"
  const voteButtonClasses = proposal.userHasVoted
    ? isIdea
      ? "bg-indigo-600 text-white hover:bg-indigo-500"
      : "bg-rose-600 text-white hover:bg-rose-500"
    : "bg-background/80 text-foreground hover:bg-background"
  const voteIconClass = proposal.userHasVoted
    ? "text-white"
    : isIdea
      ? "text-indigo-500"
      : "text-rose-500"

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-6 top-5 h-1 rounded-full opacity-90",
          "bg-gradient-to-r",
          statusConfig.accentGradient,
        )}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  statusConfig.badgeClassName,
                )}
              >
                {statusConfig.label}
              </Badge>
              <Badge className="bg-muted/70 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {typeLabel}
              </Badge>
            </div>
            {createdAgo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" /> {createdAgo}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold leading-tight text-foreground md:text-xl">
            {proposal.titulo}
          </h3>
        </div>

        <div className="space-y-2">
          <p
            className={cn(
              "rounded-2xl border border-transparent bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground transition group-hover:border-border/60 whitespace-pre-wrap",
              !expanded && isLongText && "line-clamp-4"
            )}
          >
            {proposal.descripcion}
          </p>
          {isLongText && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:text-primary/80 h-auto p-1 px-2 font-medium rounded-full"
            >
              {expanded ? "Ver menos ↑" : "Ver texto completo ↓"}
            </Button>
          )}
        </div>

        <div className="space-y-5 border-t border-dashed border-border/60 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={proposal.userHasVoted ? "default" : "secondary"}
              size="sm"
              disabled={disabled || voting || !onToggleVote}
              onClick={() => void onToggleVote?.(proposal.id)}
              className={cn(
                "rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
                voteButtonClasses,
              )}
            >
              <ThumbsUp
                className={cn(
                  "mr-1.5 h-3.5 w-3.5",
                  voteIconClass,
                )}
              />
              {voteLabel} · {proposal.votesCount}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCommentsOpen(true)}
              className="rounded-full border border-border/50 bg-background/60 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm transition hover:bg-background"
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Comentarios · {proposal.commentsCount}
            </Button>
          </div>

          <Separator className="border-dashed" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-muted text-sm font-semibold uppercase">
                  {getInitials(proposal.authorName, proposal.creado_por_email)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5 text-sm">
                <p className="font-medium leading-tight text-foreground">{proposal.authorName}</p>
                <p className="text-xs text-muted-foreground">
                  {updatedAgo ? `Actualizada ${updatedAgo}` : "Aún sin actualizar"}
                </p>
              </div>
            </div>

            {isAdmin && onStatusChange ? (
              <Select
                value={proposal.estado}
                onValueChange={(value) => onStatusChange(value as ImprovementProposalStatus)}
                disabled={disabled}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-background/80 text-xs font-medium uppercase tracking-wide sm:w-[180px]">
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
            ) : (
              <div className="rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                {statusConfig.description}
              </div>
            )}
          </div>
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
