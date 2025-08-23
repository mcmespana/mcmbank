"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoArchivo } from "@/lib/types/database"
import { FileService, type FileUploadResult } from "@/lib/services/file-service"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

export function useMovimientoArchivos(movimientoId: string | null, delegacionCodigo?: string) {
  const [archivos, setArchivos] = useState<MovimientoArchivo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Cargar archivos del movimiento
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const TIMEOUT_MS = 10000

  const fetchArchivos = useCallback(async () => {
    if (!movimientoId) {
      setArchivos([])
      return
    }

    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    try {
      timeoutRef.current = setTimeout(() => ac.abort(), TIMEOUT_MS)
      const { data, error } = await runQuery<any[]>({
        label: 'fetch-movimiento-archivos',
        table: 'movimiento_archivo',
        timeoutMs: TIMEOUT_MS,
        build: async (signal) =>
          await supabase
            .from("movimiento_archivo")
            .select("*")
            .eq("movimiento_id", movimientoId)
            .order("subido_en", { ascending: false })
            .abortSignal(signal)
      })

      if (error) throw error

      setArchivos(data || [])
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : "Error al cargar archivos")
      }
    } finally {
      setLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [movimientoId])

  // Subir archivo
  const uploadFile = async (
    file: File, 
    bucketType: 'facturas' | 'documentos',
    descripcion?: string
  ): Promise<MovimientoArchivo> => {
    if (!movimientoId) {
      throw new Error("No hay movimiento seleccionado")
    }

    setUploading(true)
    setError(null)

    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user?.user?.id) {
        throw new Error("Usuario no autenticado")
      }

      if (!delegacionCodigo) {
        throw new Error("Código de delegación requerido")
      }

      // Subir archivo a Supabase Storage
      const uploadResult: FileUploadResult = await FileService.uploadFile(
        file,
        movimientoId,
        bucketType,
        user.user.id,
        delegacionCodigo
      )

      // Guardar metadata en la base de datos
      const archivoData = {
        movimiento_id: movimientoId,
        nombre_original: file.name,
        nombre_archivo: uploadResult.path.split('/').pop() || file.name,
        tipo_mime: file.type,
        tamaño_bytes: file.size,
        bucket: bucketType,
        path_storage: uploadResult.path,
        url_publica: uploadResult.url,
        es_factura: bucketType === 'facturas',
        descripcion: descripcion || null,
        subido_por: user.user.id,
      }

      const { data, error } = await supabase
        .from("movimiento_archivo")
        .insert([archivoData])
        .select()
        .single()

      if (error) throw error

      // Si es una factura, actualizar el campo adjunto_principal_url en movimiento
      if (bucketType === 'facturas') {
        await supabase
          .from("movimiento")
          .update({ adjunto_principal_url: uploadResult.url })
          .eq("id", movimientoId)
      }

      // Actualizar la lista de archivos
      setArchivos(prev => [data, ...prev])

      return data
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al subir archivo"
      setError(errorMsg)
      throw new Error(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  // Eliminar archivo
  const deleteFile = async (archivo: MovimientoArchivo): Promise<void> => {
    setError(null)

    try {
      // Eliminar archivo de Supabase Storage
      await FileService.deleteFile(archivo.path_storage, archivo.bucket as 'facturas' | 'documentos')

      // Eliminar metadata de la base de datos
      const { error } = await supabase
        .from("movimiento_archivo")
        .delete()
        .eq("id", archivo.id)

      if (error) throw error

      // Si era una factura principal, limpiar el campo adjunto_principal_url
      if (archivo.es_factura && movimientoId) {
        const otrasFacturas = archivos.filter(a => 
          a.id !== archivo.id && a.es_factura
        )
        
        const nuevaFacturaPrincipal = otrasFacturas.length > 0 ? otrasFacturas[0].url_publica : null
        
        await supabase
          .from("movimiento")
          .update({ adjunto_principal_url: nuevaFacturaPrincipal })
          .eq("id", movimientoId)
      }

      // Actualizar la lista de archivos
      setArchivos(prev => prev.filter(a => a.id !== archivo.id))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al eliminar archivo"
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Actualizar descripción de archivo
  const updateFileDescription = async (archivoId: string, descripcion: string): Promise<void> => {
    setError(null)

    try {
      const { error } = await supabase
        .from("movimiento_archivo")
        .update({ descripcion })
        .eq("id", archivoId)

      if (error) throw error

      // Actualizar la lista de archivos
      setArchivos(prev => prev.map(a => 
        a.id === archivoId ? { ...a, descripcion } : a
      ))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al actualizar descripción"
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Obtener archivos por tipo
  const getFacturas = () => archivos.filter(a => a.es_factura)
  const getOtrosDocumentos = () => archivos.filter(a => !a.es_factura)

  useEffect(() => {
    fetchArchivos()
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchArchivos])

  useRevalidateOnFocusJitter(fetchArchivos, { minMs: 80, maxMs: 180 })

  return {
    archivos,
    facturas: getFacturas(),
    otrosDocumentos: getOtrosDocumentos(),
    loading,
    uploading,
    error,
    uploadFile,
    deleteFile,
    updateFileDescription,
    refetch: fetchArchivos
  }
}
