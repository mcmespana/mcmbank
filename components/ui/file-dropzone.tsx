import React, { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud, File as FileIcon, X } from "lucide-react"

interface FileDropzoneProps {
  onFileChange: (file: File | null) => void
  accept?: Record<string, string[]>
  title?: string
  subtitle?: string
  actionText?: string
  formatInfo?: string
  maxFiles?: number
}

export function FileDropzone({ 
  onFileChange, 
  accept = {
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  },
  title = "Arrastra y suelta tu archivo aquí",
  subtitle = "o",
  actionText = "haz click para seleccionarlo",
  formatInfo = "Compatible con .xls y .xlsx",
  maxFiles = 1
}: FileDropzoneProps) {
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0]
        setFile(selectedFile)
        onFileChange(selectedFile)
      }
    },
    [onFileChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    multiple: maxFiles > 1,
  })

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFile(null)
    onFileChange(null)
  }

  return (
    <div
      {...getRootProps()}
      className={`relative mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-200 ${
        isDragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      {file ? (
        <div className="flex flex-col items-center gap-2 text-sm font-medium text-foreground">
          <FileIcon className="h-12 w-12 text-gray-400" />
          <span>{file.name}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="absolute top-2 right-2 rounded-full bg-background p-1 text-muted-foreground shadow-md hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <UploadCloud className="h-12 w-12" />
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-xs">{subtitle}</p>}
          <p className="font-semibold text-primary">{actionText}</p>
          {formatInfo && <p className="mt-2 text-xs text-gray-500">{formatInfo}</p>}
        </div>
      )}
    </div>
  )
}
