import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_BUCKETS = ["facturas", "documentos"] as const

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { path, bucket } = await request.json()

  if (!path || !bucket || !ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "path y bucket son requeridos" }, { status: 400 })
  }

  // Ownership check: el usuario solo puede pedir una signed URL de un archivo
  // que le sea visible vía RLS (movimiento_archivo / archivo_adjunto están
  // delegation-scoped por membresía).
  const [movimientoArchivo, archivoAdjunto] = await Promise.all([
    supabase.from("movimiento_archivo").select("id").eq("path_storage", path).eq("bucket", bucket).maybeSingle(),
    (supabase as any)
      .from("archivo_adjunto")
      .select("id")
      .eq("path_storage", path)
      .eq("bucket", bucket)
      .maybeSingle(),
  ])

  if (!movimientoArchivo.data && !archivoAdjunto.data) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300)

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Error generando URL" }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
