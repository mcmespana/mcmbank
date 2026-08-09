import type { createAdminClient } from "@/lib/supabase/admin"
import { ApiError } from "@/lib/api/errors"
import { AVISO_DESTINATARIO_LABELS } from "@/lib/types/avisos"
import type { AvisoDestinatario, AvisoTipo } from "@/lib/types/avisos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Envío por correo (Resend) de un aviso o tarea.
 *
 * Vive fuera de la ruta HTTP porque hay dos caminos que llegan aquí: la app
 * (`POST /api/avisos/notificar`, con sesión de usuario y sus comprobaciones de
 * permisos) y la API externa / servidor MCP (con clave de API). El "a quién se
 * le manda" y el aspecto del correo deben ser idénticos en ambos; la
 * autorización, no, y por eso se queda en cada llamador.
 *
 * Destinatarios:
 *   - `delegacion`      → tesoreros de esa delegación
 *   - `oficina_tecnica` → gestores centrales
 * Nunca se envía a quien escribió el aviso.
 */

const REMITENTE = "MCM Bank <no-reply@movimientoconsolacion.com>"

export interface AvisoNotificable {
  id: string
  delegacion_id: string
  tipo: string
  contenido: string
  referencia: string | null
  destinatario: string
  creado_por: string
}

export interface ResultadoNotificacion {
  destinatarios: string[]
}

export async function enviarNotificacionAviso(
  admin: AdminClient,
  aviso: AvisoNotificable,
  options: { marcarNotificadoPor?: string } = {},
): Promise<ResultadoNotificacion> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    throw new ApiError(
      503,
      "El servicio de correo no está configurado (falta RESEND_API_KEY). El aviso se ha guardado igualmente.",
    )
  }

  const destinatario = aviso.destinatario as AvisoDestinatario

  let membresiasQuery = (admin as any).from("membresia").select("usuario_id, rol")
  membresiasQuery =
    destinatario === "delegacion"
      ? membresiasQuery.eq("delegacion_id", aviso.delegacion_id).eq("rol", "tesorero")
      : membresiasQuery.eq("rol", "gestor_central")

  const { data: destinatarios, error: destError } = await membresiasQuery
  if (destError) {
    throw new ApiError(500, `No se pudieron resolver los destinatarios: ${destError.message}`)
  }

  const idsDestino = Array.from(
    new Set<string>((destinatarios ?? []).map((m: any) => String(m.usuario_id))),
  ).filter((id) => id !== aviso.creado_por)

  if (idsDestino.length === 0) {
    throw new ApiError(
      409,
      destinatario === "delegacion"
        ? "Esta delegación no tiene ningún tesorero al que avisar."
        : "No hay nadie en la oficina técnica a quien avisar.",
    )
  }

  const { data: usuarios, error: usuariosError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usuariosError) {
    throw new ApiError(500, `No se pudieron obtener los correos: ${usuariosError.message}`)
  }

  const emailPorId = new Map<string, string>()
  for (const u of usuarios?.users ?? []) {
    if (u.email) emailPorId.set(u.id, u.email)
  }

  const emails = idsDestino.map((id) => emailPorId.get(id)).filter(Boolean) as string[]
  if (emails.length === 0) {
    throw new ApiError(409, "Los destinatarios no tienen correo configurado.")
  }

  const [{ data: delegacion }, { data: perfilAutor }] = await Promise.all([
    (admin as any).from("delegacion").select("nombre").eq("id", aviso.delegacion_id).maybeSingle(),
    (admin as any).from("perfil").select("nombre_completo").eq("usuario_id", aviso.creado_por).maybeSingle(),
  ])

  const autor = perfilAutor?.nombre_completo?.trim() || emailPorId.get(aviso.creado_por) || "Alguien"
  const delegacionNombre = delegacion?.nombre || "MCM"
  const tipo = aviso.tipo as AvisoTipo
  const contenido = String(aviso.contenido ?? "")
  const referencia = aviso.referencia ? String(aviso.referencia) : null

  const asunto = `${tipo === "tarea" ? "Nueva tarea" : "Aviso"} · ${delegacionNombre} — ${resumen(contenido)}`
  const enlace = (process.env.NEXT_PUBLIC_SITE_URL || "https://banco.movimientoconsolacion.com").replace(
    /\/$/,
    "",
  )

  const html = renderEmail({
    tipo,
    contenido,
    referencia,
    autor,
    delegacionNombre,
    destinatario,
    enlace,
  })

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: emails,
        subject: asunto,
        html,
        text: renderTexto({ tipo, contenido, referencia, autor, delegacionNombre, enlace }),
        ...(emailPorId.get(aviso.creado_por) ? { reply_to: [emailPorId.get(aviso.creado_por)] } : {}),
      }),
    })

    if (!response.ok) {
      const detalle = await response.text()
      console.error("Resend rechazó la notificación del aviso:", detalle)
      throw new ApiError(502, "El correo no se pudo enviar.")
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    console.error("Error enviando la notificación del aviso:", (err as any)?.message || err)
    throw new ApiError(502, "El correo no se pudo enviar.")
  }

  const { error: updateError } = await (admin as any)
    .from("aviso")
    .update({
      notificado_en: new Date().toISOString(),
      notificado_por: options.marcarNotificadoPor ?? aviso.creado_por,
    })
    .eq("id", aviso.id)

  if (updateError) {
    // El correo ya salió: no se hace fallar la operación por el sello.
    console.warn("Aviso notificado pero no se pudo sellar notificado_en:", updateError.message)
  }

  return { destinatarios: emails }
}

function resumen(texto: string, max = 70): string {
  const limpio = texto.replace(/\s+/g, " ").trim()
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

interface EmailData {
  tipo: AvisoTipo
  contenido: string
  referencia: string | null
  autor: string
  delegacionNombre: string
  destinatario: AvisoDestinatario
  enlace: string
}

function renderEmail({ tipo, contenido, referencia, autor, delegacionNombre, destinatario, enlace }: EmailData) {
  const esTarea = tipo === "tarea"
  const etiqueta = esTarea ? "Tarea pendiente" : "Nota informativa"
  const acento = esTarea ? "#b45309" : "#2563eb"
  const acentoFondo = esTarea ? "#fffbeb" : "#eff6ff"

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
          <p style="margin:0 0 18px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${acento};">
            ${etiqueta}
          </p>
          <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#111827;white-space:pre-wrap;">${escapeHtml(contenido)}</p>
          ${
            referencia
              ? `<p style="margin:0 0 20px;"><span style="display:inline-block;background:${acentoFondo};color:${acento};border-radius:999px;padding:5px 12px;font-size:13px;">${escapeHtml(referencia)}</span></p>`
              : ""
          }
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;margin-top:4px;">
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:1.6;color:#6b7280;">
                <strong style="color:#374151;">${escapeHtml(autor)}</strong> lo ha anotado en
                <strong style="color:#374151;">${escapeHtml(delegacionNombre)}</strong><br />
                Dirigido a: ${escapeHtml(AVISO_DESTINATARIO_LABELS[destinatario])}
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;">
            <a href="${enlace}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">
              Abrir en MCM Bank
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 4px 0;text-align:center;font-size:12px;color:#9ca3af;">
          Avisos y tareas de MCM Bank · no respondas a este correo si no hace falta
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderTexto({
  tipo,
  contenido,
  referencia,
  autor,
  delegacionNombre,
  enlace,
}: Omit<EmailData, "destinatario">) {
  return [
    tipo === "tarea" ? "TAREA PENDIENTE" : "NOTA INFORMATIVA",
    "",
    contenido,
    referencia ? `\nReferencia: ${referencia}` : "",
    "",
    `${autor} · ${delegacionNombre}`,
    enlace,
  ]
    .filter((linea) => linea !== "")
    .join("\n")
}
