import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyApiKey } from "@/lib/api/external-auth"
import { errorResponse } from "@/lib/api/errors"
import { localizarArchivo, urlFirmada } from "@/lib/api/archivos"

export const runtime = "nodejs"

/**
 * GET /api/v1/archivos/{id}/descargar
 *
 * Redirige (302) a una URL firmada del fichero. Es la URL que aparece como
 * `url_descarga` en los adjuntos: se puede abrir en el navegador o pasar a
 * `curl -L`, y a diferencia de la firmada no caduca en la propia respuesta
 * —cada visita genera una nueva—.
 *
 * La clave de API va en la cabecera, igual que en el resto de la API.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyApiKey(request, "read")
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await params
    const admin = createAdminClient()
    const { fila } = await localizarArchivo(admin, id)
    const url = await urlFirmada(admin, fila.bucket, fila.path_storage, 300)
    return NextResponse.redirect(url, 302)
  } catch (err) {
    return errorResponse(err)
  }
}
