"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase/client"
import type { ImprovementProposalWithAuthor, ImprovementProposalComment } from "@/lib/types/improvement-proposals"
import { formatRelativeDate, getInitials } from "./utils"
import { toast } from "sonner"

interface ProposalCommentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: ImprovementProposalWithAuthor
  onCommentAdded?: () => void
}

export function ProposalCommentsDialog({
  open,
  onOpenChange,
  proposal,
  onCommentAdded,
}: ProposalCommentsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [comments, setComments] = useState<ImprovementProposalComment[]>([])
  const [commentDraft, setCommentDraft] = useState("")

  const hasComments = comments.length > 0
  const isIdea = proposal.tipo === "idea"
  const dialogDescription = isIdea
    ? "Comparte qué te inspira o cómo mejorarías esta idea."
    : "Añade pistas que nos ayuden a reproducir y arreglar este error."
  const commentPlaceholder = isIdea
    ? "¿Qué te parece esta propuesta?"
    : "Explica si te ocurre lo mismo o aporta más detalles."
  const loadingLabel = isIdea ? "Leyendo ideas..." : "Leyendo reportes..."
  const helperLabel = isIdea
    ? "Las aportaciones ayudan a priorizar mejoras."
    : "Cuantos más detalles compartamos, antes lo arreglaremos."

  const loadComments = useCallback(async () => {
    if (!open) return
    setLoading(true)

    const { data, error } = await (supabase as any)
      .from("propuesta_mejora_comentario")
      .select("*")
      .eq("propuesta_id", proposal.id)
      .order("creado_en", { ascending: false })

    if (error) {
      console.error("Error fetching proposal comments", error)
      toast.error("No pudimos cargar los comentarios ahora mismo")
    } else if (data) {
      setComments(data)
    }

    setLoading(false)
  }, [open, proposal.id])

  useEffect(() => {
    if (open) {
      void loadComments()
    } else {
      setCommentDraft("")
    }
  }, [open, loadComments])

  const handleSubmit = useCallback(async () => {
    const content = commentDraft.trim()
    if (!content) return

    setSubmitting(true)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) throw new Error("Necesitas iniciar sesión para comentar")

      let authorName =
        user.user_metadata?.full_name?.trim() ||
        user.email?.split("@")[0]?.replace(/\./g, " ") ||
        "Usuario"

      try {
        const { data: perfil } = await (supabase as any)
          .from("perfil")
          .select("nombre_completo")
          .eq("usuario_id", user.id)
          .maybeSingle()

        if (perfil?.nombre_completo && perfil.nombre_completo.trim()) {
          authorName = perfil.nombre_completo
        }
      } catch (profileError) {
        console.warn("No pudimos obtener el perfil del usuario para el comentario", profileError)
      }

      const { data, error } = await (supabase as any)
        .from("propuesta_mejora_comentario")
        .insert({
          propuesta_id: proposal.id,
          contenido: content,
          creado_por: user.id,
          creado_por_nombre: authorName,
          creado_por_email: user.email ?? null,
        })
        .select("*")
        .single()

      if (error) throw error

      setComments((prev) => (data ? [data, ...prev] : prev))
      setCommentDraft("")
      onCommentAdded?.()
      toast.success("¡Gracias por sumarte a la conversación!")
    } catch (err) {
      console.error("Error creando comentario", err)
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos guardar tu comentario. Inténtalo otra vez."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [commentDraft, onCommentAdded, proposal.id])

  const disableButton = submitting || commentDraft.trim().length === 0

  const commentCountLabel = useMemo(() => {
    if (loading) return loadingLabel
    if (!hasComments) return "Todavía no hay comentarios"
    return `${comments.length} comentario${comments.length === 1 ? "" : "s"}`
  }, [comments.length, hasComments, loading, loadingLabel])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold">Conversación sobre “{proposal.titulo}”</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          {commentCountLabel}
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Añadir comentario
          </label>
          <p className="text-xs text-muted-foreground">{helperLabel}</p>
          <Textarea
            rows={4}
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder={commentPlaceholder}
            className="min-h-[120px] resize-none rounded-xl border-border/60 bg-background/80"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={disableButton}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Comentar
            </Button>
          </div>
        </div>

        <Separator className="border-dashed" />

        <ScrollArea className="max-h-[320px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <LoadingSpinner className="h-4 w-4" /> Cargando comentarios...
            </div>
          ) : hasComments ? (
            <div className="space-y-4">
              {comments.map((comment) => {
                const timestamp = formatRelativeDate(comment.creado_en) ?? "Hace un ratito"
                const displayName =
                  comment.creado_por_nombre?.trim() ||
                  comment.creado_por_email?.split("@")[0]?.replace(/\./g, " ") ||
                  "Persona entusiasta"

                return (
                  <div
                    key={comment.id}
                    className="flex gap-3 rounded-lg border border-border/60 bg-card/70 p-4 text-sm shadow-sm"
                  >
                    <Avatar className="mt-0.5 h-9 w-9">
                      <AvatarFallback className="bg-muted text-[11px] font-semibold uppercase">
                        {getInitials(displayName, comment.creado_por_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">{displayName}</span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {timestamp}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {comment.contenido}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Sé la primera persona en dejar un comentario.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
