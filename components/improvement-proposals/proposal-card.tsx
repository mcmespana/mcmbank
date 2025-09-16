"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  type ImprovementProposalStatus,
  IMPROVEMENT_PROPOSAL_STATUS_LABELS,
  type ImprovementProposalWithAuthor,
  IMPROVEMENT_PROPOSAL_STATUSES,
} from "@/lib/types/improvement-proposals"
import type { ImprovementProposalStatusVisualConfig } from "./status-config"
import { Clock, Sparkles } from "lucide-react"
import { useMemo } from "react"

interface ProposalCardProps {
  proposal: ImprovementProposalWithAuthor
  statusConfig: ImprovementProposalStatusVisualConfig
  onStatusChange?: (status: ImprovementProposalStatus) => void
  isAdmin?: boolean
  disabled?: boolean
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  if (email) {
    const username = email.split("@")[0]
    const sanitized = username.replace(/\./g, " ")
    const segments = sanitized.split(/\s+/)
    if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase()
    return (segments[0].charAt(0) + segments[segments.length - 1].charAt(0)).toUpperCase()
  }
  return "?"
}

function formatRelativeDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSeconds = Math.round(diffMs / 1000)

  const thresholds = [
    { limit: 60, unit: "segundo", seconds: 1 },
    { limit: 3600, unit: "minuto", seconds: 60 },
    { limit: 86400, unit: "hora", seconds: 3600 },
    { limit: 604800, unit: "día", seconds: 86400 },
    { limit: 2629800, unit: "semana", seconds: 604800 },
    { limit: 31557600, unit: "mes", seconds: 2629800 },
  ] as const

  const absoluteSeconds = Math.abs(diffSeconds)

  for (const threshold of thresholds) {
    if (absoluteSeconds < threshold.limit) {
      const value = Math.floor(absoluteSeconds / threshold.seconds) || 1
      const suffix = value === 1 ? threshold.unit : `${threshold.unit}s`
      return diffSeconds >= 0 ? `en ${value} ${suffix}` : `hace ${value} ${suffix}`
    }
  }

  const years = Math.floor(absoluteSeconds / 31557600)
  return diffSeconds >= 0 ? `en ${years} ${years === 1 ? "año" : "años"}` : `hace ${years} ${years === 1 ? "año" : "años"}`
}

export function ProposalCard({
  proposal,
  statusConfig,
  onStatusChange,
  isAdmin = false,
  disabled = false,
}: ProposalCardProps) {
  const createdAgo = useMemo(() => formatRelativeDate(proposal.creado_en), [proposal.creado_en])
  const updatedAgo = useMemo(() => formatRelativeDate(proposal.actualizado_en), [proposal.actualizado_en])
  const statusOptions = useMemo(() => IMPROVEMENT_PROPOSAL_STATUSES, [])

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-5 top-4 h-1 rounded-full opacity-90",
          "bg-gradient-to-r",
          statusConfig.accentGradient,
        )}
      />

      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge
              className={cn(
                "border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                statusConfig.badgeClassName,
              )}
            >
              {statusConfig.label}
            </Badge>
            <h3 className="text-lg font-semibold text-foreground">{proposal.titulo}</h3>
          </div>
          {createdAgo && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {createdAgo}
            </span>
          )}
        </div>

        <p
          className="text-sm leading-relaxed text-muted-foreground"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {proposal.descripcion}
        </p>

        <div className="flex flex-col gap-4 border-t border-dashed border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
  )
}
