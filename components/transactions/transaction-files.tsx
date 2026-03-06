"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddFileButton } from "./add-file-button"
import { FileAttachmentDropzone } from "@/components/ui/file-attachment-dropzone"
import { FileList } from "./file-list"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useMovimientoArchivos } from "@/hooks/use-movimiento-archivos"
import { supabase } from "@/lib/supabase/client"

interface TransactionFilesProps {
  movementId: string | null
  delegacionId?: string | null
  onCountChange?: (count: number) => void
}

export function TransactionFiles({ movementId, delegacionId, onCountChange }: TransactionFilesProps) {
  const [delegacionCodigo, setDelegacionCodigo] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

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

  const handleFileUpload = async (file: File, bucketType: "facturas" | "documentos") => {
    setUploadingFile(true)
    try {
      await uploadFile(file, bucketType)
    } catch (error) {
      console.error("Error uploading file:", error)
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
    </div>
  )
}
