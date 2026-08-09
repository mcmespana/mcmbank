import { createAdminClient } from "@/lib/supabase/admin"
import { localizarArchivo, urlFirmada } from "@/lib/api/archivos"
import { conApi, qNumero } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/archivos/{id}/url?segundos=300
 *
 * Devuelve una URL firmada temporal para descargar el archivo. Útil cuando
 * quien consume la API necesita el enlace (para pasárselo a otro sistema) en
 * vez de la descarga directa de `/descargar`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ params: query }) => {
    const { id } = await params
    const admin = createAdminClient()
    const { fila } = await localizarArchivo(admin, id)

    const segundos = Math.min(Math.max(qNumero(query, "segundos") ?? 300, 30), 3600)
    const url = await urlFirmada(admin, fila.bucket, fila.path_storage, segundos)

    return {
      url,
      nombre: fila.nombre_original,
      tipo_mime: fila.tipo_mime,
      caduca_en_segundos: segundos,
    }
  })
}
