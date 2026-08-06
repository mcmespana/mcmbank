"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { Download, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileService } from "@/lib/services/file-service"
import { useDelegationContext } from "@/contexts/delegation-context"
import { usePagoMcmArchivos } from "@/hooks/use-pago-mcm-archivos"
import type { ArchivoAdjunto } from "@/lib/types/database"

interface PagoMcmArchivosProps {
  pagoId: string
  delegacionId: string
}

export function PagoMcmArchivos({ pagoId, delegacionId }: PagoMcmArchivosProps) {
  const { getCurrentDelegation } = useDelegationContext()
  const delegacionCodigo = getCurrentDelegation()?.codigo ?? undefined
  const { archivos, uploading, loading, error, uploadFile, deleteFile } = usePagoMcmArchivos(
    pagoId,
    delegacionId,
    delegacionCodigo,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const onDrop = async (accepted: File[]) => {
    if (accepted.length === 0) return
    try {
      for (const file of accepted) {
        await uploadFile(file, "documentos")
      }
      toast.success(accepted.length === 1 ? "Archivo subido" : `${accepted.length} archivos subidos`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir")
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: uploading || !delegacionCodigo,
    maxSize: 20 * 1024 * 1024,
  })

  const handleDelete = async (archivo: ArchivoAdjunto) => {
    setDeletingId(archivo.id)
    try {
      await deleteFile(archivo)
      toast.success("Archivo eliminado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground transition-colors",
          isDragActive && "border-primary bg-primary/5",
          (uploading || !delegacionCodigo) && "cursor-not-allowed opacity-60",
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Subiendo…</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>
              {isDragActive ? "Suelta aquí" : "Arrastra o pulsa para subir uno o varios archivos"}
            </span>
            <span className="text-[10px]">Máximo 20 MB</span>
          </>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {loading && archivos.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando archivos…
        </p>
      )}

      {archivos.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-1.5"
        >
          <span className="text-base" aria-hidden>
            {FileService.getFileIcon(a.nombre_original)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{a.nombre_original}</div>
            <div className="text-[10px] text-muted-foreground">
              {FileService.formatFileSize(a.tamano_bytes)}
            </div>
          </div>
          <a
            href={a.url_publica}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Descargar"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
            disabled={deletingId === a.id}
            onClick={() => handleDelete(a)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}
