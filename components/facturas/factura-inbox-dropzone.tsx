"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { Inbox, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { FileService } from "@/lib/services/file-service"
import { leerFacturaConIa } from "@/lib/services/factura-ia-client"

interface FacturaInboxDropzoneProps {
  delegacionId: string | null
  disabled?: boolean
  onCreated: () => void | Promise<void>
}

/** Limpia el nombre de archivo para usarlo como concepto provisional. */
function conceptoDesdeNombre(nombre: string): string {
  return nombre
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120)
}

/**
 * Bandeja de entrada: suelta uno o varios archivos y se crea una factura por
 * cada uno (estado 'bandeja'), lista para completar datos y conciliar.
 */
export function FacturaInboxDropzone({ delegacionId, disabled, onCreated }: FacturaInboxDropzoneProps) {
  const { user } = useAuth()
  const { getCurrentDelegation } = useDelegationContext()
  const delegacionCodigo = getCurrentDelegation()?.codigo ?? undefined
  const [uploading, setUploading] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [progreso, setProgreso] = useState<{ done: number; total: number } | null>(null)

  const onDrop = async (accepted: File[]) => {
    if (accepted.length === 0) return
    if (!delegacionId || !delegacionCodigo || !user) {
      toast.error("Selecciona una delegación antes de subir facturas")
      return
    }

    setUploading(true)
    setProgreso({ done: 0, total: accepted.length })
    let creadas = 0
    const nuevas: string[] = []
    try {
      for (const file of accepted) {
        const validation = FileService.validateFile(file, "facturas")
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.error}`)
          continue
        }

        const factura = await DatabaseService.createFactura({
          delegacion_id: delegacionId,
          concepto: conceptoDesdeNombre(file.name) || null,
          estado: "bandeja",
          origen: "subida",
          creado_por: user.id,
        })

        try {
          const upload = await FileService.uploadFileForEntity(
            file,
            { scope: "factura", id: factura.id },
            "facturas",
            delegacionCodigo,
          )
          await DatabaseService.registrarArchivoFactura(factura.id, delegacionId, {
            nombre_original: file.name,
            nombre_archivo: upload.path.split("/").pop() || file.name,
            tipo_mime: file.type,
            tamanoBytes: file.size,
            bucket: upload.bucket,
            path_storage: upload.path,
            url_publica: upload.url,
            subido_por: user.id,
          })
        } catch (err) {
          // Si falla la subida del archivo, no dejamos la factura vacía colgando.
          await DatabaseService.deleteFactura(factura.id).catch(() => undefined)
          throw err
        }

        creadas += 1
        nuevas.push(factura.id)
        setProgreso({ done: creadas, total: accepted.length })
      }

      if (creadas > 0) {
        toast.success(
          creadas === 1 ? "Factura añadida a la bandeja" : `${creadas} facturas añadidas a la bandeja`,
        )
        await onCreated()

        // Lectura con IA de todo el lote a la vez. Se espera a que termine para
        // que la bandeja aparezca ya con los datos puestos, pero un fallo aquí
        // no invalida la subida: las facturas ya están guardadas.
        setLeyendo(true)
        try {
          await Promise.allSettled(nuevas.map((id) => leerFacturaConIa(id)))
        } finally {
          setLeyendo(false)
          await onCreated()
        }
      }
    } catch (err) {
      toast.error("No se pudo subir: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setUploading(false)
      setProgreso(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: disabled || uploading || leyendo || !delegacionId,
    maxSize: 20 * 1024 * 1024,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group/dz relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4 py-8 text-center transition-[border-color,background-color] duration-200",
        isDragActive
          ? "border-primary bg-primary/5"
          : "hover:border-primary/50 hover:bg-primary/[0.03]",
        (disabled || uploading || leyendo || !delegacionId) && "cursor-not-allowed opacity-60",
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200",
          isDragActive ? "scale-110" : "group-hover/dz:scale-105",
        )}
      >
        {uploading || leyendo ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Inbox className="h-5 w-5" />
        )}
      </div>
      {leyendo ? (
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Leyendo las facturas con IA…
        </div>
      ) : uploading && progreso ? (
        <div className="text-sm font-medium">
          Subiendo {progreso.done + 1 > progreso.total ? progreso.total : progreso.done + 1} de{" "}
          {progreso.total}…
        </div>
      ) : (
        <>
          <div className="text-sm font-semibold tracking-tight">
            {isDragActive ? "Suelta las facturas aquí" : "Arrastra facturas a la bandeja"}
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Suelta uno o varios PDF o imágenes: se crea una factura por archivo y la IA lee el
            documento para rellenar proveedor, número, fecha e importe. También puedes pulsar para
            elegir archivos.
          </p>
        </>
      )}
    </div>
  )
}
