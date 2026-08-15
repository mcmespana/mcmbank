"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { Download, ExternalLink, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileService } from "@/lib/services/file-service"
import {
  descargarArchivo,
  getSignedFileUrl,
  olvidarUrlFirmada,
  type BucketArchivo,
} from "@/lib/utils/signed-file-url"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useFacturaArchivos } from "@/hooks/use-factura-archivos"
import type { ArchivoAdjunto } from "@/lib/types/database"

interface FacturaArchivosProps {
  facturaId: string
  delegacionId: string
  /** Aviso de que los adjuntos han cambiado (para releer la factura y el visor). */
  onCambio?: () => void
}

/**
 * Los adjuntos de la factura: una línea por archivo y tres acciones claras.
 *
 * Vive al final del panel a propósito. El documento se está viendo a la
 * izquierda mientras se rellenan los datos, así que esta sección no es "mira la
 * factura" sino "gestiona el fichero", que es lo último que se hace y casi
 * nunca. Por eso tampoco hay aquí miniatura: sería la tercera vez que se pinta
 * el mismo PDF en la misma pantalla.
 */
export function FacturaArchivos({ facturaId, delegacionId, onCambio }: FacturaArchivosProps) {
  const { getCurrentDelegation } = useDelegationContext()
  const delegacionCodigo = getCurrentDelegation()?.codigo ?? undefined
  const { archivos, uploading, loading, error, uploadFile, deleteFile } = useFacturaArchivos(
    facturaId,
    delegacionId,
    delegacionCodigo,
  )
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [armadoId, setArmadoId] = useState<string | null>(null)

  const onDrop = async (accepted: File[]) => {
    if (accepted.length === 0) return
    try {
      for (const file of accepted) {
        await uploadFile(file)
      }
      toast.success(accepted.length === 1 ? "Archivo subido" : `${accepted.length} archivos subidos`)
      onCambio?.()
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
    setArmadoId(null)
    setOcupadoId(archivo.id)
    try {
      await deleteFile(archivo)
      olvidarUrlFirmada(archivo.path_storage, archivo.bucket as BucketArchivo)
      toast.success("Archivo eliminado")
      onCambio?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar")
    } finally {
      setOcupadoId(null)
    }
  }

  const handleDescargar = async (archivo: ArchivoAdjunto) => {
    setOcupadoId(archivo.id)
    try {
      await descargarArchivo(
        archivo.path_storage,
        archivo.bucket as BucketArchivo,
        archivo.nombre_original,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el archivo")
    } finally {
      setOcupadoId(null)
    }
  }

  const handleAbrir = async (archivo: ArchivoAdjunto) => {
    // La pestaña se abre ANTES de pedir la firma: si se abriera después, el
    // navegador ya no lo consideraría un gesto del usuario y lo bloquearía.
    const pestana = window.open("", "_blank", "noopener,noreferrer")
    try {
      const url = await getSignedFileUrl(archivo.path_storage, archivo.bucket as BucketArchivo)
      if (pestana) pestana.location.href = url
      else window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      pestana?.close()
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo")
    }
  }

  return (
    <div className="space-y-2">
      {archivos.map((a) => {
        const armado = armadoId === a.id
        const ocupado = ocupadoId === a.id
        return (
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

            <AccionArchivo
              label="Descargar"
              icon={ocupado ? Loader2 : Download}
              spinning={ocupado}
              onClick={() => handleDescargar(a)}
              disabled={ocupado}
            />
            <AccionArchivo
              label="Abrir en una pestaña nueva"
              icon={ExternalLink}
              onClick={() => handleAbrir(a)}
            />

            {armado ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={ocupado}
                onClick={() => handleDelete(a)}
                onMouseLeave={() => setArmadoId(null)}
                onBlur={() => setArmadoId(null)}
              >
                ¿Seguro?
              </Button>
            ) : (
              <AccionArchivo
                label="Eliminar el archivo"
                icon={Trash2}
                destructive
                disabled={ocupado}
                onClick={() => setArmadoId(a.id)}
              />
            )}
          </div>
        )
      })}

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {loading && archivos.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando archivos…
        </p>
      )}

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
              {isDragActive
                ? "Suelta aquí"
                : archivos.length > 0
                  ? "Añadir otro archivo"
                  : "Arrastra o pulsa para subir la factura"}
            </span>
            <span className="text-[10px]">PDF o imagen · máximo 20 MB</span>
          </>
        )}
      </div>
    </div>
  )
}

function AccionArchivo({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
  spinning,
}: {
  label: string
  icon: typeof Download
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  spinning?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors disabled:opacity-50",
        destructive ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" : "hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} aria-hidden />
    </button>
  )
}
