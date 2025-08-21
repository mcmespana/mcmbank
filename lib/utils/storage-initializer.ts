"use client"

import React from "react"
import { supabase } from "@/lib/supabase/client"

export async function initializeStorageBuckets() {
  try {
    // Verificar si los buckets ya existen
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error("Error listing buckets:", listError)
      return false
    }

    const existingBuckets = buckets?.map(b => b.id) || []

    // Crear bucket para facturas si no existe
    if (!existingBuckets.includes('facturas')) {
      const { error: facturasBucketError } = await supabase.storage.createBucket('facturas', {
        public: false,
        fileSizeLimit: 20971520, // 20MB
        allowedMimeTypes: [
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
        ]
      })

      if (facturasBucketError) {
        console.error("Error creating facturas bucket:", facturasBucketError)
        return false
      }

      console.log("✅ Bucket 'facturas' created successfully")
    } else {
      console.log("✅ Bucket 'facturas' already exists")
    }

    // Crear bucket para documentos si no existe
    if (!existingBuckets.includes('documentos')) {
      const { error: documentosBucketError } = await supabase.storage.createBucket('documentos', {
        public: false,
        fileSizeLimit: 20971520, // 20MB
        allowedMimeTypes: [
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
      })

      if (documentosBucketError) {
        console.error("Error creating documentos bucket:", documentosBucketError)
        return false
      }

      console.log("✅ Bucket 'documentos' created successfully")
    } else {
      console.log("✅ Bucket 'documentos' already exists")
    }

    return true
  } catch (error) {
    console.error("Error initializing storage buckets:", error)
    return false
  }
}

// Hook para inicializar los buckets automáticamente
export function useStorageInitializer() {
  const [initialized, setInitialized] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    initializeStorageBuckets().then((success) => {
      setInitialized(success)
      setLoading(false)
    })
  }, [])

  return { initialized, loading }
}
