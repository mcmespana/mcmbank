"use client"

import { useMemo, useState } from "react"
import { Sparkles, PartyPopper, EyeOff, Eye, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ProposalsBoard } from "./proposals-board"
import { CreateProposalDialog } from "./create-proposal-dialog"
import { useImprovementProposals } from "@/hooks/use-improvement-proposals"
import useIsAdmin from "@/hooks/use-is-admin"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ImprovementProposalStatus } from "@/lib/types/improvement-proposals"

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
  const [showCompleted, setShowCompleted] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [manualRefresh, setManualRefresh] = useState(false)

  const stats = useMemo(() => {
    const total = proposals.length
    const celebrating = proposals.filter((proposal) => proposal.estado === "hechisimo").length
    const active = proposals.filter((proposal) => proposal.estado !== "hechisimo").length
    const fresh = proposals.filter((proposal) => proposal.estado === "nueva_idea").length

    return { total, celebrating, active, fresh }
  }, [proposals])

  const handleCreateProposal = async (values: { title: string; description: string}) => {
    try {
      await createProposal(values)
      toast.success("¡Gracias por compartir tu idea! ✨")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No pudimos guardar tu propuesta. Quizá es una buena propuesta que este sitema funcione, pero mira, no se puede tener todo."
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
      const message =
        err instanceof Error ? err.message : "No pudimos actualizar el estado de la idea. ¿Nos proponemos mejorarlo?"
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
      toast.success("Ideas actualizadas")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No pudimos actualizar la lista de ideas. Un fallito tontorrón..."
      toast.error(message)
    } finally {
      setManualRefresh(false)
    }
  }

  const showCelebratedToggle = proposals.some((proposal) => proposal.estado === "hechisimo")

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 text-white shadow-lg">
        <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-sky-400/30 blur-3xl" />

        <div className="relative grid gap-8 p-8 md:grid-cols-[2fr_1fr] md:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-sm font-medium uppercase tracking-wide text-white/90">
              <Sparkles className="h-4 w-4" /> Propuestas de mejora
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                ¿Por qué no mejoramos esto?
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                onClick={() => setDialogOpen(true)}
                className="rounded-full bg-white text-indigo-700 shadow-lg shadow-indigo-900/20 transition hover:bg-white/90"
              >
                <PartyPopper className="mr-2 h-5 w-5" /> Compartir idea
              </Button>

              {showCelebratedToggle && (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => setShowCompleted((prev) => !prev)}
                  className={cn(
                    "rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30",
                    showCompleted && "bg-white text-indigo-700 hover:bg-white/90",
                  )}
                >
                  {showCompleted ? (
                    <>
                      <EyeOff className="mr-2 h-5 w-5" /> Ocultar Desarrollos Hechísimos
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-5 w-5" /> Mostrar Desarrollos Hechísimos
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleRefresh}
                disabled={manualRefresh || loading}
                className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <RefreshCw className={cn("mr-2 h-5 w-5", manualRefresh && "animate-spin")} />
                Refrescar
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
              {isAdmin && <Badge className="bg-white text-indigo-700 hover:bg-white">Control gestor central</Badge>}
            </div>
          </div>


        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ha ocurrido un problema</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ProposalsBoard
        proposals={proposals}
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

      <CreateProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProposal}
      />
    </div>
  )
}
