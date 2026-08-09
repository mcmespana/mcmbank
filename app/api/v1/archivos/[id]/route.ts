import { createAdminClient } from "@/lib/supabase/admin"
import { eliminarArchivo, localizarArchivo } from "@/lib/api/archivos"
import { serializeArchivo } from "@/lib/api/movimientos-public"
import { conApi } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/** GET /api/v1/archivos/{id} — metadatos del archivo y a qué está asociado. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl }) => {
    const { id } = await params
    const { fila, origen } = await localizarArchivo(createAdminClient(), id)
    return {
      archivo: serializeArchivo(fila, { baseUrl }),
      asociado_a:
        origen === "movimiento"
          ? { tipo: "movimiento", id: fila.movimiento_id }
          : { tipo: fila.entidad, id: fila.entidad_id },
    }
  })
}

/** DELETE /api/v1/archivos/{id} — borra el registro y el fichero. Irreversible. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async () => {
    const { id } = await params
    await eliminarArchivo(createAdminClient(), id)
    return { eliminado: true, id }
  })
}
