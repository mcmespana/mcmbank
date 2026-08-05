"use client"

import React, { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Download, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  FileIcon,
  Eye,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FileService } from "@/lib/services/file-service"
import { getSignedFileUrl } from "@/lib/utils/signed-file-url"
import { toast } from "sonner"
import type { MovimientoArchivo } from "@/lib/types/database"

interface FileListProps {
  archivos: MovimientoArchivo[]
  onDelete: (archivo: MovimientoArchivo) => Promise<void>
  onUpdateDescription: (archivoId: string, descripcion: string) => Promise<void>
  title: string
  emptyMessage: string
  loading?: boolean
}

export function FileList({ 
  archivos, 
  onDelete, 
  onUpdateDescription,
  title,
  emptyMessage,
  loading = false 
}: FileListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<MovimientoArchivo | null>(null)

  const handleStartEdit = (archivo: MovimientoArchivo) => {
    setEditingId(archivo.id)
    setEditingDescription(archivo.descripcion || "")
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    
    try {
      await onUpdateDescription(editingId, editingDescription)
      setEditingId(null)
      setEditingDescription("")
    } catch (error) {
      console.error("Error updating description:", error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingDescription("")
  }

  const handleDelete = async (archivo: MovimientoArchivo) => {
    setDeletingId(archivo.id)
    try {
      await onDelete(archivo)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    } catch (error) {
      console.error("Error deleting file:", error)
    } finally {
      setDeletingId(null)
    }
  }

  const openDeleteDialog = (archivo: MovimientoArchivo) => {
    setFileToDelete(archivo)
    setDeleteDialogOpen(true)
  }

  const openArchivo = async (archivo: MovimientoArchivo) => {
    try {
      const url = await getSignedFileUrl(archivo.path_storage, archivo.bucket as 'facturas' | 'documentos')
      window.open(url, '_blank')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el archivo")
    }
  }

  const handleDownload = (archivo: MovimientoArchivo) => {
    openArchivo(archivo)
  }

  const handleView = (archivo: MovimientoArchivo) => {
    // Para PDFs e imágenes, abrir en nueva pestaña; para el resto, descargar
    // (ambos casos usan la misma signed URL bajo demanda).
    openArchivo(archivo)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="text-sm text-muted-foreground">Cargando archivos...</div>
      </div>
    )
  }

  if (archivos.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <EmptyState
          title="Sin archivos adjuntos"
          description={emptyMessage}
          icon={<FileIcon className="h-6 w-6" />}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Badge variant="secondary" className="text-xs">
          {archivos.length}
        </Badge>
      </div>
      
      <div className="space-y-2">
        {archivos.map((archivo) => (
          <div
            key={archivo.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            {/* Icono del archivo */}
            <div className="flex-shrink-0 text-lg">
              {FileService.getFileIcon(archivo.nombre_original)}
            </div>

            {/* Información del archivo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium truncate">
                  {archivo.nombre_original}
                </span>
                {archivo.es_factura && (
                  <Badge variant="default" className="text-xs">
                    Factura
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>{FileService.formatFileSize(archivo.tamaño_bytes)}</span>
                <span>•</span>
                <span>{archivo.subido_en ? format(new Date(archivo.subido_en), "dd MMM yyyy", { locale: es }) : "—"}</span>
              </div>

              {/* Descripción */}
              {editingId === archivo.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    placeholder="Descripción del archivo"
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    className="h-7 w-7 p-0"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : archivo.descripcion ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{archivo.descripcion}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStartEdit(archivo)}
                    className="h-5 w-5 p-0 hover:bg-muted"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartEdit(archivo)}
                  className="h-6 text-xs text-muted-foreground hover:text-foreground mt-1 px-0"
                >
                  + Añadir descripción
                </Button>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleView(archivo)}
                className="h-8 w-8 p-0"
                title="Ver archivo"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDownload(archivo)}
                className="h-8 w-8 p-0"
                title="Descargar"
              >
                <Download className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => openDeleteDialog(archivo)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Eliminar"
                disabled={deletingId === archivo.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de confirmación de eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar archivo?
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente el archivo &quot;{fileToDelete?.nombre_original}&quot;. 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => fileToDelete && handleDelete(fileToDelete)}
              disabled={deletingId === fileToDelete?.id}
            >
              {deletingId === fileToDelete?.id ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
