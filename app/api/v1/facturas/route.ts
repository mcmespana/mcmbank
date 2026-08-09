import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { buscarFacturas, crearFactura, type FacturaEstadoApi } from "@/lib/api/facturas"
import {
  conApi,
  cuerpoJson,
  qBooleano,
  qLista,
  qNumero,
  qTexto,
} from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/facturas
 *
 * Bandeja de facturas de una, varias o todas las delegaciones. Cada factura
 * trae cuánto lleva pagado, cuánto le queda y sus archivos.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params, baseUrl }) =>
    buscarFacturas(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      estados: qLista(params, "estados"),
      texto: qTexto(params, "texto"),
      numero: qTexto(params, "numero"),
      importeMin: qNumero(params, "importe_min"),
      importeMax: qNumero(params, "importe_max"),
      fechaDesde: qTexto(params, "fecha_desde"),
      fechaHasta: qTexto(params, "fecha_hasta"),
      contactoIds: qLista(params, "contactos"),
      sinConciliar: qBooleano(params, "sin_conciliar"),
      limite: qNumero(params, "limite"),
      offset: qNumero(params, "offset"),
      baseUrl,
    }),
  )
}

/**
 * POST /api/v1/facturas
 *
 * Registra una factura en la bandeja de una delegación. Admite subir el
 * archivo en la misma llamada (`archivo: { nombre, contenido_base64 }`) y
 * conciliarla con un movimiento (`movimiento_id`).
 */
export async function POST(request: Request) {
  return conApi(request, "write", async ({ baseUrl, actorHint }) => {
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()

    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const factura = await crearFactura(
      admin,
      {
        delegacion: String(cuerpo.delegacion ?? ""),
        numero: cuerpo.numero as string | null,
        concepto: cuerpo.concepto as string | null,
        importe: cuerpo.importe as number | null,
        fecha_emision: cuerpo.fecha_emision as string | null,
        moneda: cuerpo.moneda as string | null,
        estado: cuerpo.estado as FacturaEstadoApi | null,
        notas: cuerpo.notas as string | null,
        contacto_id: cuerpo.contacto_id as string | null,
        movimiento_id: cuerpo.movimiento_id as string | null,
        archivo: (cuerpo.archivo as any) ?? null,
      },
      actor.id,
      { baseUrl },
    )

    return { factura }
  })
}
