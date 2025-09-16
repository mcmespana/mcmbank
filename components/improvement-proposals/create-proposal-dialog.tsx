"use client"

import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Sparkles } from "lucide-react"

interface CreateProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { title: string; description: string }) => Promise<void>
}

export function CreateProposalDialog({ open, onOpenChange, onSubmit }: CreateProposalDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFormError(null)
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    try {
      setSubmitting(true)
      await onSubmit({ title, description})
      setTitle("")
      setDescription("")
      onOpenChange(false)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No pudimos guardar tu propuesta. Intenta otra vez",
      )
    } finally {
      setSubmitting(false)
    }
  }

  const disableSubmit = submitting || !title.trim() || !description.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-4 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-semibold text-white">
                Comparte una idea brillante
              </DialogTitle>
              <DialogDescription className="text-white/80">
                Todavía tenemos margen de mejora y mucha IA por utilizar. ¡Danos ideas para arreglar lo que falla!
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 bg-background p-6">
          <div className="space-y-2">
            <label htmlFor="proposal-title" className="text-sm font-medium text-foreground">
              Título
            </label>
            <Input
              id="proposal-title"
              placeholder="Cambiar este filtro, añadir botón para..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="proposal-description" className="text-sm font-medium text-foreground">
              Añade más detalles
            </label>
            <Textarea
              id="proposal-description"
              placeholder="Explica en más detalle tu brillante propuesta"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
            />
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Ups, algo salió mal</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
            </p>
            <Button type="submit" disabled={disableSubmit} className="sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando idea...
                </>
              ) : (
                "Publicar propuesta"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
