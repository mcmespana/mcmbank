"use client"

import { useMemo, useState } from "react"
import { Sparkles, PartyPopper, EyeOff, Eye, RefreshCw, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ProposalsBoard } from "./proposals-board"
import { CreateProposalDialog } from "./create-proposal-dialog"
import { useImprovementProposals } from "@/hooks/use-improvement-proposals"
import useIsAdmin from "@/hooks/use-is-admin"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type {
  ImprovementProposalStatus,
  ImprovementProposalType,
} from "@/lib/types/improvement-proposals"

export function ImprovementProposalsPanel() {
  const {
    proposals,
    loading,
    refreshing,
    error,
    createProposal,
    updateProposalStatus,
    toggleVote,
    votingId,
    registerComment,
    refetch,
    statusLabels,
  } = useImprovementProposals()
  const isAdmin = useIsAdmin()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<ImprovementProposalType>("idea")
  const [showCompleted, setShowCompleted] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [manualRefresh, setManualRefresh] = useState(false)
  const ideaProposals = useMemo(
    () => proposals.filter((proposal) => proposal.tipo === "idea"),
    [proposals],
  )
  const errorProposals = useMemo(
    () => proposals.filter((proposal) => proposal.tipo === "error"),
    [proposals],
  )

  const handleCreateProposal = async ({
    title,
    description,
    type,
  }: {
    title: string
    description: string
    type: ImprovementProposalType
  }) => {
    try {
      await createProposal({ title, description, type })
      toast.success(
        type === "idea"
          ? "¡Gracias por compartir tu idea! ✨"
          : "Gracias por reportar el error 🛠️",
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : type === "idea"
            ? "No pudimos guardar tu propuesta. Quizá es una buena propuesta que este sistema funcione, pero mira, no se puede tener todo."
            : "No pudimos guardar el reporte del error. Seguiremos investigando igualmente."
      toast.error(message)
      throw err
    }
  }

  const handleStatusChange = async (proposalId: string, status: ImprovementProposalStatus) => {
    try {
      setUpdatingId(proposalId)
      await updateProposalStatus(proposalId, status)
      toast.success(`Estado actualizado a ${statusLabels[status]}`)
    } catch (err) {
      const target = proposals.find((proposal) => proposal.id === proposalId)
      const message =
        err instanceof Error
          ? err.message
          : target?.tipo === "error"
            ? "No pudimos actualizar el estado del error. Lo revisamos en un rato."
            : "No pudimos actualizar el estado de la idea. ¿Nos proponemos mejorarlo?"
      toast.error(message)
      throw err
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRefresh = async () => {
    try {
      setManualRefresh(true)
      await refetch()
      toast.success("Panel actualizado")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos actualizar la lista ahora mismo. Un fallito tontorrón..."
      toast.error(message)
    } finally {
      setManualRefresh(false)
    }
  }

  const showCelebratedToggle = ideaProposals.some((proposal) => proposal.estado === "hechisimo")

  const handleOpenDialog = (type: ImprovementProposalType) => {
    setDialogType(type)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-4 text-white shadow-md sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
              <Sparkles className="h-5 w-5 flex-shrink-0" />
              ¿Por qué no mejoramos esto?
            </h1>
            <p className="text-sm text-white/80">
              {ideaProposals.length} ideas · {errorProposals.length} errores
              {isAdmin && " · gestionas los estados"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenDialog("idea")}
              className="rounded-full bg-white text-indigo-700 hover:bg-white/90"
            >
              <PartyPopper className="mr-1.5 h-4 w-4" /> Compartir idea
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleOpenDialog("error")}
              className="rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30"
            >
              <Bug className="mr-1.5 h-4 w-4" /> Reportar error
            </Button>
            {showCelebratedToggle && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCompleted((prev) => !prev)}
                title={showCompleted ? "Ocultar hechísimos" : "Mostrar hechísimos"}
                className={cn(
                  "rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30",
                  showCompleted && "bg-white text-indigo-700 hover:bg-white/90",
                )}
              >
                {showCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Hechísimos</span>
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={manualRefresh || loading}
              title="Refrescar"
              className="rounded-full border-white/30 bg-white/10 px-2.5 text-white hover:bg-white/20"
            >
              <RefreshCw className={cn("h-4 w-4", manualRefresh && "animate-spin")} />
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ha ocurrido un problema</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Errores primero */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <Bug className="h-5 w-5" />
          Errores reportados
        </h2>

        <ProposalsBoard
          type="error"
          proposals={errorProposals}
          loading={loading}
          refreshing={refreshing || manualRefresh}
          isAdmin={isAdmin}
          updatingId={updatingId}
          onStatusChange={isAdmin ? handleStatusChange : undefined}
          onToggleVote={toggleVote}
          votingId={votingId}
          onCommentAdded={registerComment}
        />
      </section>

      {/* Ideas después */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Sparkles className="h-5 w-5" />
          Ideas de mejora
        </h2>

        <ProposalsBoard
          type="idea"
          proposals={ideaProposals}
          loading={loading}
          refreshing={refreshing || manualRefresh}
          showCompleted={showCompleted}
          isAdmin={isAdmin}
          updatingId={updatingId}
          onStatusChange={isAdmin ? handleStatusChange : undefined}
          onToggleVote={toggleVote}
          votingId={votingId}
          onCommentAdded={registerComment}
        />
      </section>

      <CreateProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        onTypeChange={setDialogType}
        onSubmit={handleCreateProposal}
      />
    </div>
  )
}
