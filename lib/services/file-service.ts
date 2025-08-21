"use client"

import { supabase } from "@/lib/supabase/client"

export interface FileUploadResult {
  url: string
  path: string
  bucket: string
}

export class FileService {
  private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
  
  private static readonly ALLOWED_MIME_TYPES = {
    facturas: [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ],
    documentos: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-rar-compressed',
      'video/mp4',
      'audio/mpeg',
      'audio/wav'
    ]
  }

  private static getMonthAbbreviation(monthIndex: number): string {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                   'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return months[monthIndex]
  }

  static validateFile(file: File, bucketType: 'facturas' | 'documentos'): { valid: boolean; error?: string } {
    // Validar tamaño
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `El archivo es demasiado grande. Máximo permitido: 20MB`
      }
    }

    // Validar tipo MIME
    const allowedTypes = this.ALLOWED_MIME_TYPES[bucketType]
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Tipo de archivo no permitido: ${file.type}`
      }
    }

    return { valid: true }
  }

  static async uploadFile(
    file: File, 
    movimientoId: string, 
    bucketType: 'facturas' | 'documentos',
    userId: string,
    delegacionCodigo: string
  ): Promise<FileUploadResult> {
    // Validar archivo
    const validation = this.validateFile(file, bucketType)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Generar estructura de carpetas organizada
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = this.getMonthAbbreviation(now.getMonth())
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Estructura: delegacion/año/mes/uuid/archivo_original.ext
    const fileName = `${delegacionCodigo}/${year}/${month}/${movimientoId}/${cleanFileName}`

    try {
      // Subir archivo a Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketType)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        throw new Error(`Error al subir archivo: ${error.message}`)
      }

      // Obtener URL pública del archivo
      const { data: urlData } = supabase.storage
        .from(bucketType)
        .getPublicUrl(data.path)

      return {
        url: urlData.publicUrl,
        path: data.path,
        bucket: bucketType
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  static async deleteFile(path: string, bucket: 'facturas' | 'documentos'): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        throw new Error(`Error al eliminar archivo: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }

  static async listFiles(movimientoId: string, bucket: 'facturas' | 'documentos'): Promise<any[]> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(movimientoId, {
          limit: 100,
          offset: 0
        })

      if (error) {
        throw new Error(`Error al listar archivos: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error listing files:', error)
      throw error
    }
  }

  static getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'pdf':
        return '📄'
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return '🖼️'
      case 'xls':
      case 'xlsx':
        return '📊'
      case 'doc':
      case 'docx':
        return '📝'
      case 'txt':
        return '📄'
      case 'csv':
        return '📋'
      case 'zip':
      case 'rar':
        return '🗜️'
      case 'mp4':
        return '🎥'
      case 'mp3':
      case 'wav':
        return '🎵'
      default:
        return '📎'
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
