"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InformesService } from "@/lib/services/informes"
import type { InformeArchivo } from "@/lib/types/database"
import { Loader2, ExternalLink, Download } from "lucide-react"

interface PdfViewerDialogProps {
  archivo: InformeArchivo | null
  onClose: () => void
}

/** Convierte un enlace de Drive en su versión /preview embebible. */
function toDrivePreview(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return url
}

export function PdfViewerDialog({ archivo, onClose }: PdfViewerDialogProps) {
  // La URL de Drive es derivable en render; solo la URL firmada de Storage es async.
  const driveUrl = archivo?.drive_url ? toDrivePreview(archivo.drive_url) : null
  const storagePath = archivo?.drive_url ? null : archivo?.storage_path ?? null
  // Resultado de la firma async; setState solo dentro del callback (sin estado síncrono en el efecto).
  const [signed, setSigned] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!storagePath || signed?.path === storagePath) return
    let active = true
    InformesService.getSignedUrl(storagePath)
      .then((url) => {
        if (active) setSigned({ path: storagePath, url })
      })
      .catch(() => {
        if (active) setSigned({ path: storagePath, url: null })
      })
    return () => {
      active = false
    }
  }, [storagePath, signed])

  const resolved = storagePath && signed?.path === storagePath ? signed : null
  const url = driveUrl ?? resolved?.url ?? null
  const loading = !!storagePath && !resolved

  const open = !!archivo

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{archivo?.nombre}</DialogTitle>
        </DialogHeader>

        <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-muted/20">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <iframe src={url} className="h-full w-full" title={archivo?.nombre ?? "Documento"} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No se pudo cargar la vista previa.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {url && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {archivo?.drive_url ? (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir en Drive
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" /> Descargar
                  </>
                )}
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
