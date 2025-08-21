"use client"

import React, { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, File as FileIcon, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { FileService } from "@/lib/services/file-service"

interface FileAttachmentDropzoneProps {
  onFileSelect: (file: File) => void
  bucketType: 'facturas' | 'documentos'
  title?: string
  subtitle?: string
  disabled?: boolean
  className?: string
}

export function FileAttachmentDropzone({ 
  onFileSelect,
  bucketType,
  title,
  subtitle,
  disabled = false,
  className
}: FileAttachmentDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null)
      
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError("El archivo es demasiado grande (máximo 20MB)")
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError("Tipo de archivo no permitido")
        } else {
          setError("Error al procesar el archivo")
        }
        return
      }

      if (acceptedFiles && acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        
        // Validar archivo usando nuestro servicio
        const validation = FileService.validateFile(file, bucketType)
        if (!validation.valid) {
          setError(validation.error || "Error de validación")
          return
        }

        setSelectedFile(file)
        onFileSelect(file)
      }
    },
    [onFileSelect, bucketType]
  )

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
  }

  const getAcceptedFileTypes = () => {
    const baseTypes = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    }

    if (bucketType === 'documentos') {
      return {
        ...baseTypes,
        'application/zip': ['.zip'],
        'application/x-rar-compressed': ['.rar'],
        'video/mp4': ['.mp4'],
        'audio/mpeg': ['.mp3'],
        'audio/wav': ['.wav']
      }
    }

    return baseTypes
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(),
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
    disabled
  })

  return (
    <div className={cn("space-y-2", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200",
          isDragActive 
            ? "border-primary bg-primary/10" 
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "cursor-not-allowed opacity-50",
          selectedFile && "border-green-200 bg-green-50/50"
        )}
      >
        <input {...getInputProps()} />
        
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2 text-sm font-medium text-foreground">
            <div className="flex items-center gap-2">
              <span className="text-lg">{FileService.getFileIcon(selectedFile.name)}</span>
              <FileIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="max-w-[200px] truncate">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">
              {FileService.formatFileSize(selectedFile.size)}
            </span>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="absolute top-2 right-2 rounded-full bg-background p-1 text-muted-foreground shadow-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
              aria-label="Quitar archivo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <p className="text-sm font-medium">
              {title || (bucketType === 'facturas' ? 'Arrastra la factura aquí' : 'Arrastra el archivo aquí')}
            </p>
            {subtitle && <p className="text-xs">{subtitle}</p>}
            <p className="text-xs font-medium text-primary">o haz clic para seleccionar</p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground text-center">
        Máximo 20MB
      </p>
    </div>
  )
}
