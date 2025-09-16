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

  const handleCreateProposal = async (values: { title: string; description: string; impact?: string | null }) => {
    try {
      await createProposal(values)
      toast.success("¡Gracias por compartir tu idea! ✨")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No pudimos guardar tu propuesta. Intenta de nuevo más tarde."
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
        err instanceof Error ? err.message : "No pudimos actualizar el estado de la idea. Intenta más tarde."
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
        err instanceof Error ? err.message : "No pudimos actualizar la lista de ideas. Vuelve a intentarlo."
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
                Impulsemos juntos el futuro de MCM Bank
              </h1>
              <p className="text-base text-white/80 md:max-w-xl">
                Comparte ideas, inspírate con otras personas y sigue cómo evolucionan las mejoras que marcarán la diferencia.
              </p>
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
                      <EyeOff className="mr-2 h-5 w-5" /> Ocultar Hechísimo
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-5 w-5" /> Mostrar Hechísimo
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
              <Badge className="bg-white/20 text-white hover:bg-white/30">Todos ven todo</Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/30">Sin moderación previa</Badge>
              {isAdmin && <Badge className="bg-white text-indigo-700 hover:bg-white">Control gestor central</Badge>}
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/30 bg-white/10 p-6 text-white shadow-inner backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Panorama actual</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-4xl font-semibold">{stats.total}</p>
                <p className="text-sm text-white/70">ideas activas en el panel</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-2xl font-semibold">{stats.fresh}</p>
                  <p className="text-xs text-white/70">recién llegadas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.active}</p>
                  <p className="text-xs text-white/70">en movimiento</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.celebrating}</p>
                  <p className="text-xs text-white/70">celebradas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{showCompleted ? stats.celebrating : stats.active}</p>
                  <p className="text-xs text-white/70">{showCompleted ? "visibles" : "a la vista"}</p>
                </div>
              </div>
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
      />

      <CreateProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProposal}
      />
    </div>
  )
}
