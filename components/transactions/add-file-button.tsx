"use client"

import React, { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileAttachmentDropzone } from "@/components/ui/file-attachment-dropzone"
import { cn } from "@/lib/utils"

interface AddFileButtonProps {
  onFileSelect: (file: File) => void
  bucketType: 'facturas' | 'documentos'
  title?: string
  disabled?: boolean
  className?: string
}

export function AddFileButton({ 
  onFileSelect,
  bucketType,
  title,
  disabled = false,
  className
}: AddFileButtonProps) {
  const [showDropzone, setShowDropzone] = useState(false)

  const handleFileSelect = (file: File) => {
    onFileSelect(file)
    setShowDropzone(false)
  }

  if (showDropzone) {
    return (
      <div className={cn("space-y-3", className)}>
        <FileAttachmentDropzone
          onFileSelect={handleFileSelect}
          bucketType={bucketType}
          title={title}
          disabled={disabled}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropzone(false)}
          className="w-full"
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowDropzone(true)}
      disabled={disabled}
      className={cn("w-full border-dashed", className)}
    >
      <Plus className="h-4 w-4 mr-2" />
      Añadir otro archivo
    </Button>
  )
}
