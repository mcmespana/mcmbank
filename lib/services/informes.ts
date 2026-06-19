"use client"

import { supabase } from "@/lib/supabase/client"
import type {
  Informe,
  InformeArchivo,
  InformeConArchivos,
  InformeInsert,
  InformeUpdate,
} from "@/lib/types/database"

const BUCKET = "informes"

function sanitizeFileName(name: string): string {
  const parts = name.split(".")
  const ext = parts.length > 1 ? "." + parts.pop() : ""
  const base = parts.join(".").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80)
  return `${base || "archivo"}${ext.toLowerCase()}`
}

export const InformesService = {
  /** Lista los informes de una delegación con sus archivos. */
  async list(delegacionId: string): Promise<InformeConArchivos[]> {
    const { data, error } = await (supabase as any)
      .from("informe")
      .select("*, archivos:informe_archivo(*)")
      .eq("delegacion_id", delegacionId)
      .order("anio", { ascending: false })
      .order("creado_en", { ascending: false })

    if (error) throw error
    return (data || []) as InformeConArchivos[]
  },

  async create(payload: InformeInsert): Promise<Informe> {
    const { data: userRes } = await supabase.auth.getUser()
    const creado_por = userRes?.user?.id ?? null

    const { data, error } = await (supabase as any)
      .from("informe")
      .insert([{ ...payload, creado_por }])
      .select()
      .single()

    if (error) throw error
    return data as Informe
  },

  async update(id: string, patch: InformeUpdate): Promise<Informe> {
    const { data, error } = await (supabase as any)
      .from("informe")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return data as Informe
  },

  async remove(informe: Informe & { archivos?: InformeArchivo[] }): Promise<void> {
    // Borrar archivos de Storage primero
    const paths = (informe.archivos || [])
      .map((a) => a.storage_path)
      .filter((p): p is string => !!p)
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths)
      if (storageError) console.error("Error eliminando archivos de Storage:", storageError)
    }
    // Borrar fila (cascade elimina informe_archivo)
    const { error } = await (supabase as any).from("informe").delete().eq("id", informe.id)
    if (error) throw error
  },

  /** Sube un archivo a Storage y registra su metadata. */
  async uploadArchivo(
    informeId: string,
    delegacionId: string,
    file: File,
    options?: { esPdfPrincipal?: boolean },
  ): Promise<InformeArchivo> {
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id ?? null

    const path = `${delegacionId}/${informeId}/${Date.now()}_${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false })
    if (uploadError) throw new Error(`Error al subir archivo: ${uploadError.message}`)

    const row = {
      informe_id: informeId,
      nombre: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      es_pdf_principal:
        options?.esPdfPrincipal ?? file.type === "application/pdf",
      creado_por: userId,
    }

    const { data, error } = await (supabase as any)
      .from("informe_archivo")
      .insert([row])
      .select()
      .single()
    if (error) {
      // rollback del archivo subido
      await supabase.storage.from(BUCKET).remove([path])
      throw error
    }
    return data as InformeArchivo
  },

  /** Registra un enlace externo de Drive como "archivo". */
  async addDriveLink(informeId: string, nombre: string, driveUrl: string): Promise<InformeArchivo> {
    const { data: userRes } = await supabase.auth.getUser()
    const { data, error } = await (supabase as any)
      .from("informe_archivo")
      .insert([
        {
          informe_id: informeId,
          nombre,
          drive_url: driveUrl,
          creado_por: userRes?.user?.id ?? null,
        },
      ])
      .select()
      .single()
    if (error) throw error
    return data as InformeArchivo
  },

  async removeArchivo(archivo: InformeArchivo): Promise<void> {
    if (archivo.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([archivo.storage_path])
      if (storageError) console.error("Error eliminando archivo de Storage:", storageError)
    }
    const { error } = await (supabase as any)
      .from("informe_archivo")
      .delete()
      .eq("id", archivo.id)
    if (error) throw error
  },

  /** URL firmada temporal para ver/descargar un archivo del bucket privado. */
  async getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn)
    if (error) {
      console.error("Error creando signed URL:", error)
      return null
    }
    return data?.signedUrl ?? null
  },
}
