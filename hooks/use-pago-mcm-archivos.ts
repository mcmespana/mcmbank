"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { FileService, type FileUploadResult } from "@/lib/services/file-service"
import { runQuery } from "@/lib/db/query"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import type { ArchivoAdjunto } from "@/lib/types/database"

const TIMEOUT_MS = 10000

/**
 * Maneja los adjuntos polimórficos (entidad='pago_mcm') de un pago MCM.
 * Es deliberadamente paralelo a useMovimientoArchivos, pero opera sobre
 * la tabla `archivo_adjunto`, no `movimiento_archivo`.
 */
export function usePagoMcmArchivos(
  pagoId: string | null,
  delegacionId: string | null,
  delegacionCodigo?: string,
) {
  const { user } = useAuth()
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchArchivos = useCallback(async () => {
    if (!pagoId) {
      setArchivos([])
      return
    }
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    try {
      const { data, error } = await runQuery<any[]>({
        label: "fetch-pago-mcm-archivos",
        table: "archivo_adjunto",
        timeoutMs: TIMEOUT_MS,
        build: async (signal) =>
          await (supabase as any)
            .from("archivo_adjunto")
            .select("*")
            .eq("entidad", "pago_mcm")
            .eq("entidad_id", pagoId)
            .order("subido_en", { ascending: false })
            .abortSignal(signal),
      })
      if (error) throw error
      setArchivos(data || [])
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "Error al cargar archivos")
    } finally {
      setLoading(false)
    }
  }, [pagoId])

  useEffect(() => {
    fetchArchivos()
    return () => abortRef.current?.abort()
  }, [fetchArchivos])

  useRevalidateOnFocusJitter(fetchArchivos, { minMs: 80, maxMs: 180 })

  const uploadFile = useCallback(
    async (
      file: File,
      bucketType: "facturas" | "documentos",
      descripcion?: string,
    ): Promise<ArchivoAdjunto> => {
      if (!pagoId || !delegacionId) throw new Error("Pago o delegación no disponibles")
      if (!user) throw new Error("Usuario no autenticado")
      if (!delegacionCodigo) throw new Error("Código de delegación requerido")

      setUploading(true)
      setError(null)
      try {
        const uploadResult: FileUploadResult = await FileService.uploadFileForEntity(
          file,
          { scope: "pago-mcm", id: pagoId },
          bucketType,
          delegacionCodigo,
        )

        const insert = {
          entidad: "pago_mcm" as const,
          entidad_id: pagoId,
          delegacion_id: delegacionId,
          nombre_original: file.name,
          nombre_archivo: uploadResult.path.split("/").pop() || file.name,
          tipo_mime: file.type,
          tamano_bytes: file.size,
          bucket: bucketType,
          path_storage: uploadResult.path,
          url_publica: uploadResult.url,
          es_factura: bucketType === "facturas",
          descripcion: descripcion || null,
          subido_por: user.id,
        }

        const { data, error } = await (supabase as any)
          .from("archivo_adjunto")
          .insert([insert])
          .select()
          .single()
        if (error) throw error

        setArchivos((prev) => [data, ...prev])
        return data as ArchivoAdjunto
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al subir archivo"
        setError(msg)
        throw new Error(msg)
      } finally {
        setUploading(false)
      }
    },
    [pagoId, delegacionId, delegacionCodigo, user],
  )

  const deleteFile = useCallback(async (archivo: ArchivoAdjunto): Promise<void> => {
    setError(null)
    try {
      await FileService.deleteFile(archivo.path_storage, archivo.bucket)
      const { error } = await (supabase as any)
        .from("archivo_adjunto")
        .delete()
        .eq("id", archivo.id)
      if (error) throw error
      setArchivos((prev) => prev.filter((a) => a.id !== archivo.id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar archivo"
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const updateFileDescription = useCallback(async (archivoId: string, descripcion: string): Promise<void> => {
    setError(null)
    try {
      const { error } = await (supabase as any)
        .from("archivo_adjunto")
        .update({ descripcion })
        .eq("id", archivoId)
      if (error) throw error
      setArchivos((prev) => prev.map((a) => (a.id === archivoId ? { ...a, descripcion } : a)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar descripción"
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  return {
    archivos,
    loading,
    uploading,
    error,
    uploadFile,
    deleteFile,
    updateFileDescription,
    refetch: fetchArchivos,
  }
}
