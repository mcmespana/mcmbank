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
import { Loader2, Sparkles, Bug } from "lucide-react"
import type { ImprovementProposalType } from "@/lib/types/improvement-proposals"

interface CreateProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ImprovementProposalType
  onTypeChange?: (type: ImprovementProposalType) => void
  onSubmit: (values: {
    title: string
    description: string
    type: ImprovementProposalType
  }) => Promise<void>
}

const TYPE_COPY: Record<
  ImprovementProposalType,
  {
    title: string
    description: string
    titlePlaceholder: string
    descriptionPlaceholder: string
    submitLabel: string
    submittingLabel: string
    helperText: string
    icon: typeof Sparkles
  }
> = {
  idea: {
    title: "Comparte una idea brillante",
    description:
      "Todavía tenemos margen de mejora y mucha IA por utilizar. ¡Danos ideas para arreglar lo que falla!",
    titlePlaceholder: "Cambiar este filtro, añadir botón para...",
    descriptionPlaceholder: "Explica en más detalle tu brillante propuesta",
    submitLabel: "Publicar propuesta",
    submittingLabel: "Enviando idea...",
    helperText:
      "Las ideas nos ayudan a priorizar mejoras. Cuéntanos qué impacto tendría tu propuesta.",
    icon: Sparkles,
  },
  error: {
    title: "Reporta un error",
    description:
      "Si algo no funciona como debería, déjanos los detalles para poder reproducirlo y arreglarlo pronto.",
    titlePlaceholder: "Error al descargar extracto...",
    descriptionPlaceholder:
      "Describe qué sucede, cómo reproducirlo y qué esperabas que pasara",
    submitLabel: "Reportar error",
    submittingLabel: "Enviando reporte...",
    helperText:
      "Incluye pasos claros y, si puedes, capturas o mensajes de error. Cuanta más información, mejor.",
    icon: Bug,
  },
}

export function CreateProposalDialog({
  open,
  onOpenChange,
  onSubmit,
  type,
  onTypeChange,
}: CreateProposalDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<ImprovementProposalType>(type)

  useEffect(() => {
    if (!open) {
      setFormError(null)
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    setSelectedType(type)
  }, [type])

  const copy = TYPE_COPY[selectedType]

  const handleTypeSelection = (value: ImprovementProposalType) => {
    setSelectedType(value)
    onTypeChange?.(value)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    try {
      setSubmitting(true)
      await onSubmit({ title, description, type: selectedType })
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
              <copy.icon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-semibold text-white">
                {copy.title}
              </DialogTitle>
              <DialogDescription className="text-white/80">
                {copy.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 bg-background p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant={selectedType === "idea" ? "default" : "secondary"}
              className="rounded-full"
              onClick={() => handleTypeSelection("idea")}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Compartir idea
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedType === "error" ? "default" : "secondary"}
              className="rounded-full"
              onClick={() => handleTypeSelection("error")}
            >
              <Bug className="mr-2 h-4 w-4" /> Reportar error
            </Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="proposal-title" className="text-sm font-medium text-foreground">
              Título
            </label>
            <Input
              id="proposal-title"
              placeholder={copy.titlePlaceholder}
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
              placeholder={copy.descriptionPlaceholder}
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
            <p className="text-sm text-muted-foreground">{copy.helperText}</p>
            <Button type="submit" disabled={disableSubmit} className="sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {copy.submittingLabel}
                </>
              ) : (
                copy.submitLabel
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
