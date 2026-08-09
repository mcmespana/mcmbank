import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, errorResponse } from "@/lib/api/errors"
import { resolveActor } from "@/lib/api/actor"
import { conciliarLote, type ItemConciliacion } from "@/lib/api/facturas"
import { verifyApiKey } from "@/lib/api/external-auth"

export const runtime = "nodejs"

/**
 * POST /api/v1/conciliacion
 *
 * Cuadra un lote de facturas contra los movimientos bancarios: se envía una
 * lista de importes (con fecha, proveedor o número si se conocen) y se devuelve,
 * para cada uno, los movimientos que mejor encajan, con su puntuación y los
 * motivos en texto.
 *
 * ```json
 * {
 *   "facturas": [
 *     { "referencia": "linea-1", "importe": 128.40, "fecha": "2026-03-04", "proveedor": "Mercadona" }
 *   ],
 *   "delegaciones": ["Sevilla"],
 *   "aplicar": false,
 *   "crear_facturas": false
 * }
 * ```
 *
 * Por defecto solo propone (basta clave de lectura). Con `aplicar: true` —que
 * exige clave de escritura— vincula automáticamente los casos claros (importe
 * exacto y ventaja clara sobre el segundo candidato) y deja los dudosos para
 * que los revise una persona.
 */
export async function POST(request: Request) {
  // El permiso necesario depende del cuerpo (`aplicar`), así que primero se
  // valida la clave para lectura —y así no se lee el cuerpo de una petición
  // anónima— y después se exige escritura si toca.
  const auth = verifyApiKey(request, "read")
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const cuerpo = await request.json().catch(() => null)
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      throw badRequest("El cuerpo de la petición debe ser un objeto JSON.")
    }

    const datos = cuerpo as Record<string, unknown>
    const aplicar = Boolean(datos.aplicar)

    if (aplicar && auth.scope !== "write") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "'aplicar: true' modifica datos y tu clave es de solo lectura. Llama sin 'aplicar' para ver las propuestas.",
        },
        { status: 403 },
      )
    }

    if (!Array.isArray(datos.facturas)) {
      throw badRequest("Falta la lista 'facturas'.")
    }

    const admin = createAdminClient()
    const actor = aplicar
      ? await resolveActor(admin, {
          usuario_id: (datos.usuario_id as string) ?? request.headers.get("x-mcm-usuario-id"),
          usuario_email:
            (datos.usuario_email as string) ?? request.headers.get("x-mcm-usuario-email"),
        })
      : null

    const resultado = await conciliarLote(
      admin,
      {
        items: datos.facturas as ItemConciliacion[],
        delegaciones: (datos.delegaciones as string[] | string | null) ?? null,
        ventanaDias: datos.ventana_dias as number | undefined,
        maxCandidatos: datos.max_candidatos as number | undefined,
        aplicar,
        crearFacturas: Boolean(datos.crear_facturas),
      },
      actor?.id ?? null,
    )

    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    return errorResponse(err)
  }
}
