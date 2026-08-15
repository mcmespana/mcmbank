"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddFileButton } from "./add-file-button"
import { FileAttachmentDropzone } from "@/components/ui/file-attachment-dropzone"
import { FileList } from "./file-list"
import {
  AlertTriangle,
  ArrowUpRight,
  Link2,
  Loader2,
  ReceiptText,
  Trash2,
  Unlink,
} from "lucide-react"
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
  // Desvincular es un paso; borrar la factura de la bandeja es otro, y se
  // pregunta después, para que quede claro qué se está eliminando en cada uno.
  const [desvincularOpen, setDesvincularOpen] = useState(false)
  const [desvinculando, setDesvinculando] = useState(false)
  const [facturaDesvinculada, setFacturaDesvinculada] = useState<FacturaConRelaciones | null>(null)
  const [eliminandoFactura, setEliminandoFactura] = useState(false)
  const [accionError, setAccionError] = useState<string | null>(null)

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
    detachFile,
    updateFileDescription,
  } = useMovimientoArchivos(movementId || null, delegacionCodigo || undefined)

  /**
   * Adjuntos de este movimiento que son, en realidad, el documento de la
   * factura vinculada: al vincular se copia la fila apuntando al MISMO objeto
   * de Storage. Por eso no se pueden borrar sin más desde aquí.
   */
  const archivosDeFacturaVinculada = useMemo(() => {
    const paths = new Set(
      (facturaVinculada?.archivos ?? []).map((a: any) => a.path_storage).filter(Boolean),
    )
    if (paths.size === 0) return []
    return archivos.filter((a) => paths.has(a.path_storage))
  }, [archivos, facturaVinculada])

  const esArchivoDeFacturaVinculada = useCallback(
    (archivo: MovimientoArchivo) => archivosDeFacturaVinculada.some((a) => a.id === archivo.id),
    [archivosDeFacturaVinculada],
  )

  /**
   * Paso 1: quita el vínculo movimiento ↔ factura y retira del movimiento la
   * copia del documento. La factura y su archivo siguen intactos en la bandeja.
   */
  const handleDesvincular = async () => {
    if (!movementId || !facturaVinculada) return
    setDesvinculando(true)
    setAccionError(null)
    try {
      await DatabaseService.unlinkFacturaFromMovimiento(facturaVinculada.id, movementId)
      for (const archivo of archivosDeFacturaVinculada) {
        await detachFile(archivo)
      }
      const factura = facturaVinculada
      await fetchFacturaVinculada()
      setDesvincularOpen(false)
      toast.success("Vínculo eliminado. La factura sigue en la bandeja de Facturas")
      // Paso 2: ofrecer eliminarla también de la bandeja.
      setFacturaDesvinculada(factura)
    } catch (error) {
      console.error("Error al desvincular la factura:", error)
      setAccionError(
        error instanceof Error ? error.message : "No se pudo quitar el vínculo. Inténtalo de nuevo.",
      )
    } finally {
      setDesvinculando(false)
    }
  }

  /** Paso 2 (opcional): borra la factura de la bandeja, con su documento. */
  const handleEliminarFactura = async () => {
    if (!facturaDesvinculada) return
    setEliminandoFactura(true)
    setAccionError(null)
    try {
      await DatabaseService.deleteFactura(facturaDesvinculada.id)
      setFacturaDesvinculada(null)
      toast.success("Factura eliminada de la bandeja")
    } catch (error) {
      console.error("Error al eliminar la factura:", error)
      setAccionError(
        error instanceof Error ? error.message : "No se pudo eliminar la factura. Inténtalo de nuevo.",
      )
    } finally {
      setEliminandoFactura(false)
    }
  }

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
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2.5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                <ReceiptText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80">
                  Vinculada con la factura
                </p>
                <p className="truncate text-sm font-semibold">
                  {facturaVinculada.concepto?.trim() || "Sin título"}
                </p>
                <p className="truncate text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  {facturaVinculada.importe != null && (
                    <>{formatCurrency(Number(facturaVinculada.importe))} · </>
                  )}
                  {FACTURA_ESTADO_INFO[facturaVinculada.estado].label}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  title="Ver la factura"
                >
                  <Link href={`/facturas?factura=${facturaVinculada.id}${movementId ? `&mov=${movementId}` : ""}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="sr-only">Ver la factura</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  title="Quitar el vínculo con esta factura"
                  onClick={() => {
                    setAccionError(null)
                    setDesvincularOpen(true)
                  }}
                >
                  <Unlink className="h-4 w-4" />
                  <span className="sr-only">Quitar el vínculo</span>
                </Button>
              </div>
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
              onDeleteIntercept={(archivo) => {
                if (!esArchivoDeFacturaVinculada(archivo)) return false
                setAccionError(null)
                setDesvincularOpen(true)
                return true
              }}
              deleteTitleFor={(archivo) =>
                esArchivoDeFacturaVinculada(archivo)
                  ? "Quitar el vínculo con la factura"
                  : "Eliminar el archivo"
              }
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

      {/* Paso 1: quitar el vínculo (la factura NO se borra) */}
      <Dialog
        open={desvincularOpen}
        onOpenChange={(open) => {
          setDesvincularOpen(open)
          if (!open) setAccionError(null)
        }}
      >
        <DialogContent className="z-[80]" overlayClassName="z-[70]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlink className="h-5 w-5 text-amber-600" />
              ¿Quitar el vínculo con la factura?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Este movimiento dejará de estar vinculado a la factura{" "}
                  <span className="font-medium text-foreground">
                    {facturaVinculada?.concepto?.trim() || "sin título"}
                  </span>
                  .
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>El documento se quita de este movimiento.</li>
                  <li>
                    La factura <span className="font-medium">sigue en la sección Facturas</span>, con
                    su archivo, sin vincular a ningún movimiento.
                  </li>
                  <li>El movimiento no se toca: solo se deshace la conciliación.</li>
                </ul>
                <p>Después te preguntamos si además quieres eliminarla de la bandeja.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {accionError && (
            <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-300">{accionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesvincularOpen(false)} disabled={desvinculando}>
              Cancelar
            </Button>
            <Button onClick={handleDesvincular} disabled={desvinculando}>
              {desvinculando ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Quitando...
                </>
              ) : (
                <>
                  <Unlink className="mr-1.5 h-4 w-4" />
                  Quitar el vínculo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paso 2: ya desvinculada, ¿la borramos también de la bandeja? */}
      <Dialog
        open={Boolean(facturaDesvinculada)}
        onOpenChange={(open) => {
          if (!open) {
            setFacturaDesvinculada(null)
            setAccionError(null)
          }
        }}
      >
        <DialogContent className="z-[80]" overlayClassName="z-[70]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              ¿Eliminar también la factura de la bandeja?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  El vínculo ya está quitado. La factura{" "}
                  <span className="font-medium text-foreground">
                    {facturaDesvinculada?.concepto?.trim() || "sin título"}
                  </span>{" "}
                  sigue en la sección Facturas.
                </p>
                <p>
                  Si la eliminas, se borran la factura y su documento de forma permanente. No se puede
                  deshacer.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {accionError && (
            <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-300">{accionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFacturaDesvinculada(null)}
              disabled={eliminandoFactura}
            >
              No, dejarla en la bandeja
            </Button>
            <Button variant="destructive" onClick={handleEliminarFactura} disabled={eliminandoFactura}>
              {eliminandoFactura ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar la factura
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
