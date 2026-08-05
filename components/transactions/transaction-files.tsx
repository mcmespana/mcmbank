"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AddFileButton } from "./add-file-button"
import { FileAttachmentDropzone } from "@/components/ui/file-attachment-dropzone"
import { FileList } from "./file-list"
import { AlertTriangle, CheckCircle2, Link2, Loader2, ReceiptText } from "lucide-react"
import { toast } from "sonner"
import { useMovimientoArchivos } from "@/hooks/use-movimiento-archivos"
import { supabase } from "@/lib/supabase/client"
import { DatabaseService } from "@/lib/services/database"
import { VincularFacturaDialog } from "@/components/facturas/vincular-factura-dialog"
import { FACTURA_ESTADO_INFO } from "@/lib/utils/facturas"
import { formatCurrency } from "@/lib/utils/format"
import type { FacturaConRelaciones, MovimientoArchivo } from "@/lib/types/database"

interface TransactionFilesProps {
  movementId: string | null
  delegacionId?: string | null
  onCountChange?: (count: number) => void
}

export function TransactionFiles({ movementId, delegacionId, onCountChange }: TransactionFilesProps) {
  const [delegacionCodigo, setDelegacionCodigo] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [facturaVinculada, setFacturaVinculada] = useState<FacturaConRelaciones | null>(null)
  const [vincularOpen, setVincularOpen] = useState(false)

  useEffect(() => {
    const getDelegacionCodigo = async () => {
      if (!delegacionId) {
        setDelegacionCodigo(null)
        return
      }

      try {
        const { data, error } = await (supabase as any)
          .from("delegacion")
          .select("codigo")
          .eq("id", delegacionId)
          .single()

        if (error || !data?.codigo) {
          console.error("Error getting delegation code:", error)
          setDelegacionCodigo("SIN-CODIGO")
          return
        }

        setDelegacionCodigo(data.codigo)
      } catch (error) {
        console.error("Error getting delegation code:", error)
        setDelegacionCodigo("SIN-CODIGO")
      }
    }

    getDelegacionCodigo()
  }, [delegacionId])

  const fetchFacturaVinculada = useCallback(async () => {
    if (!movementId) {
      setFacturaVinculada(null)
      return
    }
    try {
      const factura = await DatabaseService.getFacturaByMovimiento(movementId)
      setFacturaVinculada(factura)
    } catch {
      setFacturaVinculada(null)
    }
  }, [movementId])

  useEffect(() => {
    fetchFacturaVinculada()
  }, [fetchFacturaVinculada])

  const {
    archivos,
    facturas,
    otrosDocumentos,
    loading: archivosLoading,
    uploading: archivosUploading,
    error: archivosError,
    uploadFile,
    deleteFile,
    updateFileDescription,
  } = useMovimientoArchivos(movementId || null, delegacionCodigo || undefined)

  useEffect(() => {
    onCountChange?.(archivos.length)
  }, [archivos, onCountChange])

  /**
   * Al subir una factura al movimiento, además del adjunto se crea (si no
   * existe) la entidad factura al otro lado, ya conciliada con este movimiento
   * y con sus datos (fecha, importe, contacto). Mínimos clicks.
   */
  const registrarFacturaEntidad = async (archivo: MovimientoArchivo) => {
    if (!movementId || !delegacionId) return
    try {
      const yaVinculada = Boolean(facturaVinculada)
      const factura = await DatabaseService.ensureFacturaForMovimiento(movementId, {
        creadoPor: archivo.subido_por,
      })
      await DatabaseService.registrarArchivoFactura(factura.id, delegacionId, {
        nombre_original: archivo.nombre_original,
        nombre_archivo: archivo.nombre_archivo,
        tipo_mime: archivo.tipo_mime,
        tamanoBytes: archivo["tamaño_bytes"],
        bucket: archivo.bucket,
        path_storage: archivo.path_storage,
        url_publica: archivo.url_publica,
        descripcion: archivo.descripcion,
        subido_por: archivo.subido_por,
      })
      await fetchFacturaVinculada()
      if (!yaVinculada) {
        toast.success("Factura registrada en la sección Facturas y conciliada con este movimiento")
      }
    } catch (err) {
      console.warn("No se pudo registrar la entidad factura:", err)
    }
  }

  const handleFileUpload = async (file: File, bucketType: "facturas" | "documentos") => {
    setUploadingFile(true)
    try {
      const archivo = await uploadFile(file, bucketType)
      if (bucketType === "facturas") {
        await registrarFacturaEntidad(archivo)
      }
      toast.success("Archivo subido correctamente")
    } catch (error) {
      console.error("Error uploading file:", error)
      toast.error(error instanceof Error ? error.message : "No se pudo subir el archivo. Inténtalo de nuevo.")
    } finally {
      setUploadingFile(false)
    }
  }

  return (
    <div className="space-y-6">
      {archivosError && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{archivosError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">FACTURA</h3>

          {/* Estado de conciliación con la sección Facturas */}
          {facturaVinculada ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-2.5 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Conciliada con la factura{" "}
                <span className="font-medium">
                  {facturaVinculada.concepto?.trim() || "sin título"}
                </span>
                {facturaVinculada.importe != null && (
                  <> · {formatCurrency(Number(facturaVinculada.importe))}</>
                )}
                {" "}({FACTURA_ESTADO_INFO[facturaVinculada.estado].label.toLowerCase()})
              </span>
              <Link
                href="/facturas"
                className="shrink-0 font-medium underline-offset-2 hover:underline"
              >
                Ver
              </Link>
            </div>
          ) : (
            movementId &&
            delegacionId && (
              <div className="mb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setVincularOpen(true)}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Vincular una factura de la bandeja
                  <ReceiptText className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )
          )}

          {facturas.length === 0 ? (
            <FileAttachmentDropzone
              onFileSelect={(file) => handleFileUpload(file, "facturas")}
              bucketType="facturas"
              title="Arrastra la factura aquí"
              disabled={uploadingFile || archivosUploading}
              className="mb-4"
            />
          ) : (
            <div className="space-y-3">
              <AddFileButton
                onFileSelect={(file) => handleFileUpload(file, "facturas")}
                bucketType="facturas"
                title="Arrastra otra factura aquí"
                disabled={uploadingFile || archivosUploading}
              />
            </div>
          )}

          {facturas.length > 0 && (
            <FileList
              archivos={facturas}
              onDelete={deleteFile}
              onUpdateDescription={updateFileDescription}
              title="Facturas subidas"
              emptyMessage="No hay facturas adjuntas"
              loading={archivosLoading}
            />
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">OTROS ARCHIVOS</h3>
          {otrosDocumentos.length === 0 ? (
            <FileAttachmentDropzone
              onFileSelect={(file) => handleFileUpload(file, "documentos")}
              bucketType="documentos"
              title="Arrastra el archivo aquí"
              disabled={uploadingFile || archivosUploading}
              className="mb-4"
            />
          ) : (
            <div className="space-y-3">
              <AddFileButton
                onFileSelect={(file) => handleFileUpload(file, "documentos")}
                bucketType="documentos"
                title="Arrastra otro archivo aquí"
                disabled={uploadingFile || archivosUploading}
              />
            </div>
          )}

          {otrosDocumentos.length > 0 && (
            <FileList
              archivos={otrosDocumentos}
              onDelete={deleteFile}
              onUpdateDescription={updateFileDescription}
              title="Otros documentos"
              emptyMessage="No hay otros archivos adjuntos"
              loading={archivosLoading}
            />
          )}
        </div>

        {(uploadingFile || archivosUploading) && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Subiendo archivo...</span>
          </div>
        )}
      </div>

      {/* Vincular una factura existente de la bandeja a este movimiento */}
      <VincularFacturaDialog
        movimientoId={movementId}
        open={vincularOpen}
        onOpenChange={setVincularOpen}
        onLinked={fetchFacturaVinculada}
      />
    </div>
  )
}
