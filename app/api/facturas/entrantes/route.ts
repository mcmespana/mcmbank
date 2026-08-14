import { NextResponse, after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { extraerDatosFactura } from "@/lib/api/factura-ia"
import {
  parsearEventoResend,
  procesarCorreoEntrante,
  verificarFirmaResend,
} from "@/lib/api/facturas-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/facturas/entrantes
 *
 * Webhook de Resend para el buzón de facturas
 * (`facturas+<delegacion>@movimientoconsolacion.com`). Es la única ruta de la
 * app a la que escribe alguien de fuera, así que el orden importa:
 *
 *   1. Sin secreto configurado → 503. Falla cerrada: sin firma que comprobar,
 *      cualquiera podría meter facturas en la bandeja de cualquier delegación.
 *   2. Firma inválida o caducada → 401, sin tocar nada.
 *   3. A partir de ahí se responde **200 casi siempre**, incluso cuando el
 *      correo no se ha podido encaminar: reintentar no lo va a arreglar y lo
 *      que ha pasado queda escrito en `factura_email`.
 *
 * La lectura con IA se lanza después de responder (`after`), porque el webhook
 * tiene que contestar rápido y leer tres PDFs puede llevar medio minuto.
 */
export async function POST(request: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET
  if (!secreto) {
    console.error("Buzón de facturas: falta RESEND_WEBHOOK_SECRET, se rechaza la petición.")
    return NextResponse.json(
      { ok: false, error: "El buzón de facturas no está configurado en este servidor." },
      { status: 503 },
    )
  }

  const cuerpoCrudo = await request.text()
  const firma = verificarFirmaResend(cuerpoCrudo, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  }, secreto)

  if (!firma.ok) {
    console.warn("Buzón de facturas: firma rechazada —", firma.motivo)
    return NextResponse.json({ ok: false, error: "Firma no válida." }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(cuerpoCrudo)
  } catch {
    return NextResponse.json({ ok: false, error: "El cuerpo no es JSON." }, { status: 400 })
  }

  const evento = parsearEventoResend(payload)
  if (!evento) {
    // Otro tipo de evento (entregas, rebotes…): ni error ni trabajo.
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const admin = createAdminClient()

  // Toda escritura necesita un autor real. Si el servidor no tiene cuenta por
  // defecto configurada, se devuelve 503 a propósito: Resend reintentará y el
  // correo entrará solo en cuanto se configure, en vez de perderse.
  let actorId: string
  try {
    actorId = (await resolveActor(admin)).id
  } catch (err) {
    console.error("Buzón de facturas: no hay usuario al que atribuir las facturas.", err)
    return NextResponse.json(
      {
        ok: false,
        error:
          "Falta configurar MCM_API_USER_EMAIL (o MCM_API_USER_ID) para poder registrar las facturas recibidas por correo.",
      },
      { status: 503 },
    )
  }

  try {
    const resultado = await procesarCorreoEntrante(admin, evento, { actorId })

    if (resultado.facturasCreadas.length > 0) {
      after(async () => {
        for (const facturaId of resultado.facturasCreadas) {
          try {
            await extraerDatosFactura(admin, facturaId, { actorId })
          } catch (err) {
            console.warn(`No se pudo leer con IA la factura ${facturaId}:`, err)
          }
        }
      })
    }

    return NextResponse.json({
      ok: true,
      estado: resultado.estado,
      facturas: resultado.facturasCreadas.length,
    })
  } catch (err) {
    // Aquí solo se llega ante un fallo inesperado (la base de datos caída, por
    // ejemplo): ahí sí interesa que Resend reintente.
    console.error("Buzón de facturas: error inesperado.", err)
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 })
  }
}
