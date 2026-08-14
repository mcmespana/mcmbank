import { createHmac, timingSafeEqual } from "node:crypto"
import type { createAdminClient } from "@/lib/supabase/admin"
import { ApiError, unwrap } from "@/lib/api/errors"
import { subirArchivoAFactura } from "@/lib/api/archivos"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Buzón de facturas por delegación.
 *
 * Cada delegación tiene una dirección —`facturas+castellon@dominio`— a la que
 * reenviar las facturas que le llegan de sus proveedores. Resend recibe el
 * correo, lo trocea y avisa por webhook; aquí se convierte cada adjunto en una
 * factura de la bandeja de esa delegación.
 *
 * Lo que entra por aquí **no está autenticado**: a esa dirección puede escribir
 * cualquiera. Por eso todo lo que llega aterriza en `bandeja` (que en esta app
 * ya significa "pendiente de que alguien lo mire"), nada se concilia solo, y
 * cada correo queda registrado en `factura_email` con su remitente.
 *
 * Ver `plans/022-facturas-por-email-y-lectura-con-ia.md` y
 * `docs/FACTURAS_EMAIL_IA.md`.
 */

const RESEND_API = "https://api.resend.com"

/** Tope por adjunto. Más generoso que el de la API porque aquí no viaja en base64. */
export const MAX_BYTES_ADJUNTO_EMAIL = 10 * 1024 * 1024
export const MAX_ADJUNTOS_POR_CORREO = 10
const MAX_CUERPO_GUARDADO = 4000

/** Tipos que se aceptan como documento de una factura. */
const MIME_ACEPTADOS = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

/**
 * Imágenes diminutas incrustadas: logotipos de la firma del remitente, píxeles
 * de seguimiento, iconos de redes sociales. Crear una factura por cada una
 * llenaría la bandeja de basura.
 */
const MIN_BYTES_IMAGEN = 20 * 1024

// ---------------------------------------------------------------------------
// Verificación de la firma del webhook
// ---------------------------------------------------------------------------

export interface CabecerasFirma {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/**
 * Comprueba la firma svix con la que Resend firma sus webhooks.
 *
 * El esquema es HMAC-SHA256 sobre `id.timestamp.cuerpo` con el secreto
 * (`whsec_…`, en base64 tras el prefijo). La cabecera `svix-signature` puede
 * traer varias firmas separadas por espacios (`v1,xxx v1,yyy`) durante una
 * rotación de secreto, así que vale con que **una** encaje.
 *
 * Se implementa a mano en vez de traer el SDK de Resend o `svix` por lo mismo
 * que el resto del módulo habla por `fetch`: son veinte líneas y una
 * dependencia menos en la ruta más expuesta de la app.
 */
export function verificarFirmaResend(
  cuerpoCrudo: string,
  cabeceras: CabecerasFirma,
  secreto: string,
  ahora: Date = new Date(),
): { ok: true } | { ok: false; motivo: string } {
  if (!cabeceras.id || !cabeceras.timestamp || !cabeceras.signature) {
    return { ok: false, motivo: "faltan las cabeceras svix-id/svix-timestamp/svix-signature" }
  }

  const marca = Number(cabeceras.timestamp)
  if (!Number.isFinite(marca)) return { ok: false, motivo: "svix-timestamp no es un número" }
  const desfaseSegundos = Math.abs(ahora.getTime() / 1000 - marca)
  if (desfaseSegundos > 300) {
    return { ok: false, motivo: "la firma tiene más de 5 minutos (posible reenvío)" }
  }

  const secretoLimpio = secreto.startsWith("whsec_") ? secreto.slice(6) : secreto
  let clave: Buffer
  try {
    clave = Buffer.from(secretoLimpio, "base64")
  } catch {
    return { ok: false, motivo: "el secreto configurado no es base64 válido" }
  }
  if (clave.length === 0) return { ok: false, motivo: "el secreto configurado está vacío" }

  const esperada = createHmac("sha256", clave)
    .update(`${cabeceras.id}.${cabeceras.timestamp}.${cuerpoCrudo}`)
    .digest("base64")
  const esperadaBuf = Buffer.from(esperada)

  const firmas = cabeceras.signature
    .split(" ")
    .map((parte) => parte.split(",").slice(1).join(","))
    .filter(Boolean)

  for (const firma of firmas) {
    const candidata = Buffer.from(firma)
    if (candidata.length === esperadaBuf.length && timingSafeEqual(candidata, esperadaBuf)) {
      return { ok: true }
    }
  }

  return { ok: false, motivo: "la firma no coincide" }
}

// ---------------------------------------------------------------------------
// De la dirección a la delegación
// ---------------------------------------------------------------------------

/** Nombre del buzón: la parte antes del `+`. */
export function buzonFacturas(): string {
  return (process.env.FACTURAS_EMAIL_LOCAL?.trim() || "facturas").toLowerCase()
}

/** Deja `Nombre Apellido <a@b.com>` en `a@b.com`. */
function soloDireccion(valor: string): string {
  const conAngulos = valor.match(/<([^>]+)>/)
  return (conAngulos ? conAngulos[1] : valor).trim().toLowerCase()
}

/**
 * Etiquetas de delegación que aparecen entre los destinatarios de un correo.
 *
 * Se aceptan las tres formas que pueden llegar según cómo se monte el buzón
 * (ver la tabla de opciones en `plans/022`):
 *
 *   facturas+castellon@dominio     → castellon   (sub-direccionamiento)
 *   facturas-castellon@dominio     → castellon   (proveedores que no admiten '+')
 *   castellon@facturas.dominio     → castellon   (MX en un subdominio)
 *
 * Se miran **todos** los destinatarios conocidos, incluidas las cabeceras de
 * reenvío: cuando Workspace reenvía a Resend, la dirección original solo
 * sobrevive en `To:`/`Delivered-To:`.
 */
export function aliasesDeDestinatarios(direcciones: (string | null | undefined)[]): string[] {
  const buzon = buzonFacturas()
  const encontrados: string[] = []

  for (const bruta of direcciones) {
    if (!bruta) continue
    const direccion = soloDireccion(String(bruta))
    const arroba = direccion.lastIndexOf("@")
    if (arroba <= 0) continue

    const local = direccion.slice(0, arroba)
    const dominio = direccion.slice(arroba + 1)

    let etiqueta: string | null = null
    if (local.startsWith(`${buzon}+`)) etiqueta = local.slice(buzon.length + 1)
    else if (local.startsWith(`${buzon}-`)) etiqueta = local.slice(buzon.length + 1)
    else if (dominio.startsWith(`${buzon}.`) && local !== buzon) etiqueta = local

    const limpia = (etiqueta ?? "").replace(/[^a-z0-9-]/g, "")
    if (limpia && !encontrados.includes(limpia)) encontrados.push(limpia)
  }

  return encontrados
}

export interface DelegacionBuzon {
  id: string
  nombre: string
  codigo: string | null
  alias_email: string | null
}

/**
 * Busca la delegación de una etiqueta. Primero por `alias_email`, que es lo
 * que la gente escribe; después por `codigo`, para que
 * `facturas+mcm-cs@` también funcione sin haber configurado nada.
 */
export async function resolverDelegacionPorAlias(
  admin: AdminClient,
  alias: string[],
): Promise<{ delegacion: DelegacionBuzon; alias: string } | null> {
  if (alias.length === 0) return null

  const delegaciones = (unwrap(
    await (admin as any).from("delegacion").select("id, nombre, codigo, alias_email"),
  ) ?? []) as DelegacionBuzon[]

  for (const etiqueta of alias) {
    const porAlias = delegaciones.find((d) => (d.alias_email ?? "").toLowerCase() === etiqueta)
    if (porAlias) return { delegacion: porAlias, alias: etiqueta }
  }
  for (const etiqueta of alias) {
    const porCodigo = delegaciones.find(
      (d) => (d.codigo ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "") === etiqueta,
    )
    if (porCodigo) return { delegacion: porCodigo, alias: etiqueta }
  }
  return null
}

// ---------------------------------------------------------------------------
// El evento de Resend
// ---------------------------------------------------------------------------

export interface EventoEmailRecibido {
  emailId: string
  messageId: string | null
  remitente: string | null
  destinatarios: string[]
  asunto: string | null
  recibidoEn: string | null
}

/** Lee el `email.received` de Resend. Devuelve `null` si es otro evento. */
export function parsearEventoResend(payload: any): EventoEmailRecibido | null {
  if (payload?.type !== "email.received") return null
  const data = payload?.data
  if (!data?.email_id) return null

  const destinatarios = [
    ...(Array.isArray(data.to) ? data.to : []),
    ...(Array.isArray(data.cc) ? data.cc : []),
    ...(Array.isArray(data.bcc) ? data.bcc : []),
    ...(Array.isArray(data.received_for) ? data.received_for : []),
  ].map((d: unknown) => String(d))

  return {
    emailId: String(data.email_id),
    messageId: data.message_id ? String(data.message_id) : null,
    remitente: data.from ? String(data.from) : null,
    destinatarios,
    asunto: data.subject ? String(data.subject) : null,
    recibidoEn: data.created_at ? String(data.created_at) : payload.created_at ?? null,
  }
}

interface EmailCompleto {
  texto: string | null
  html: string | null
  cabeceras: Record<string, unknown>
}

interface AdjuntoResend {
  id: string
  filename: string
  content_type: string
  size?: number
  download_url?: string
}

async function resendGet<T>(ruta: string): Promise<T> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new ApiError(503, "Falta RESEND_API_KEY: no se puede descargar el correo recibido.")
  }
  const respuesta = await fetch(`${RESEND_API}${ruta}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!respuesta.ok) {
    const detalle = (await respuesta.text().catch(() => "")).slice(0, 300)
    throw new ApiError(502, `Resend respondió ${respuesta.status} al pedir ${ruta}: ${detalle}`)
  }
  return (await respuesta.json()) as T
}

async function descargarEmail(emailId: string): Promise<EmailCompleto> {
  const json = await resendGet<any>(`/emails/receiving/${emailId}`)
  return {
    texto: typeof json?.text === "string" ? json.text : null,
    html: typeof json?.html === "string" ? json.html : null,
    cabeceras: (json?.headers ?? {}) as Record<string, unknown>,
  }
}

async function listarAdjuntos(emailId: string): Promise<AdjuntoResend[]> {
  const json = await resendGet<any>(`/emails/receiving/${emailId}/attachments`)
  const lista = Array.isArray(json) ? json : (json?.data ?? [])
  return (lista as AdjuntoResend[]).filter((a) => a && a.id)
}

async function descargarAdjunto(emailId: string, adjunto: AdjuntoResend): Promise<Buffer> {
  let url = adjunto.download_url
  if (!url) {
    const fresco = await resendGet<any>(`/emails/receiving/${emailId}/attachments/${adjunto.id}`)
    url = fresco?.download_url
  }
  if (!url) throw new ApiError(502, `Resend no dio enlace de descarga para '${adjunto.filename}'.`)

  const respuesta = await fetch(url)
  if (!respuesta.ok) {
    throw new ApiError(502, `No se pudo descargar '${adjunto.filename}' (${respuesta.status}).`)
  }
  return Buffer.from(await respuesta.arrayBuffer())
}

/** Cabeceras que conservan el destinatario original cuando el correo viene reenviado. */
function destinatariosDeCabeceras(cabeceras: Record<string, unknown>): string[] {
  const interesantes = ["to", "cc", "delivered-to", "x-forwarded-to", "x-original-to", "envelope-to"]
  const salida: string[] = []
  for (const [clave, valor] of Object.entries(cabeceras ?? {})) {
    if (!interesantes.includes(clave.toLowerCase())) continue
    const textos = Array.isArray(valor) ? valor : [valor]
    for (const texto of textos) {
      // Una cabecera puede llevar varias direcciones separadas por comas.
      for (const parte of String(texto ?? "").split(",")) {
        if (parte.trim()) salida.push(parte.trim())
      }
    }
  }
  return salida
}

function textoPlano(email: EmailCompleto): string | null {
  if (email.texto?.trim()) return email.texto.trim()
  if (!email.html) return null
  return (
    email.html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  )
}

// ---------------------------------------------------------------------------
// Procesado
// ---------------------------------------------------------------------------

export interface ResultadoCorreo {
  estado: "procesado" | "sin_delegacion" | "sin_adjuntos" | "duplicado" | "error"
  delegacionId: string | null
  facturasCreadas: string[]
  mensaje: string
}

/**
 * Convierte un correo recibido en facturas de la bandeja.
 *
 * Devuelve siempre un resultado (no lanza salvo error de programación): al
 * webhook hay que contestarle 200 aunque el correo no se haya podido encaminar,
 * porque un 500 solo consigue que Resend lo reintente cinco veces con el mismo
 * resultado. Lo que no se ha podido hacer queda en `factura_email` con su
 * motivo.
 */
export async function procesarCorreoEntrante(
  admin: AdminClient,
  evento: EventoEmailRecibido,
  options: { actorId: string },
): Promise<ResultadoCorreo> {
  // 1) Idempotencia: la fila con `proveedor_email_id` único hace de cerrojo.
  //    Si ya existe, este webhook es un reintento y no hay nada que hacer.
  const { data: registro, error: errorRegistro } = await (admin as any)
    .from("factura_email")
    .insert({
      proveedor_email_id: evento.emailId,
      message_id: evento.messageId,
      remitente: evento.remitente,
      destinatarios: evento.destinatarios,
      asunto: evento.asunto,
      recibido_en: evento.recibidoEn,
      estado: "procesado",
    })
    .select("id")
    .single()

  if (errorRegistro) {
    const codigo = (errorRegistro as any)?.code
    if (codigo === "23505") {
      return {
        estado: "duplicado",
        delegacionId: null,
        facturasCreadas: [],
        mensaje: "Este correo ya se había procesado.",
      }
    }
    throw new ApiError(500, `No se pudo registrar el correo entrante: ${errorRegistro.message}`)
  }

  const registroId = registro.id

  try {
    // 2) El cuerpo del correo hace falta en dos casos: para sacar el
    //    destinatario original de las cabeceras si el correo viene reenviado, y
    //    para no perder el contenido cuando no hay adjuntos.
    const email = await descargarEmail(evento.emailId).catch((err) => {
      console.warn("No se pudo descargar el cuerpo del correo:", err?.message ?? err)
      return { texto: null, html: null, cabeceras: {} } as EmailCompleto
    })

    const alias = aliasesDeDestinatarios([
      ...evento.destinatarios,
      ...destinatariosDeCabeceras(email.cabeceras),
    ])
    const encontrada = await resolverDelegacionPorAlias(admin, alias)
    const cuerpo = textoPlano(email)
    const extracto = cuerpo ? cuerpo.slice(0, MAX_CUERPO_GUARDADO) : null

    if (!encontrada) {
      await actualizarRegistro(admin, registroId, {
        estado: "sin_delegacion",
        error: `No se ha podido saber a qué delegación va dirigido. Destinatarios: ${
          evento.destinatarios.join(", ") || "(ninguno)"
        }`,
        cuerpo_extracto: extracto,
      })
      return {
        estado: "sin_delegacion",
        delegacionId: null,
        facturasCreadas: [],
        mensaje: "Ninguna delegación coincide con la dirección de destino.",
      }
    }

    const { delegacion, alias: aliasUsado } = encontrada

    // 3) Adjuntos: uno por factura.
    const adjuntos = await listarAdjuntos(evento.emailId).catch((err) => {
      console.warn("No se pudieron listar los adjuntos:", err?.message ?? err)
      return [] as AdjuntoResend[]
    })

    const utiles = adjuntos
      .filter((a) => MIME_ACEPTADOS.includes(String(a.content_type).toLowerCase()))
      .filter(
        (a) =>
          !String(a.content_type).toLowerCase().startsWith("image/") ||
          (a.size ?? MIN_BYTES_IMAGEN) >= MIN_BYTES_IMAGEN,
      )
      .filter((a) => (a.size ?? 0) <= MAX_BYTES_ADJUNTO_EMAIL)
      .slice(0, MAX_ADJUNTOS_POR_CORREO)

    const creadas: string[] = []
    const problemas: string[] = []

    for (const adjunto of utiles) {
      try {
        const contenido = await descargarAdjunto(evento.emailId, adjunto)
        if (contenido.length > MAX_BYTES_ADJUNTO_EMAIL) {
          problemas.push(`'${adjunto.filename}' pesa más de ${MAX_BYTES_ADJUNTO_EMAIL / 1024 / 1024} MB`)
          continue
        }

        const facturaId = await crearFacturaDeCorreo(admin, {
          delegacionId: delegacion.id,
          concepto: evento.asunto,
          remitente: evento.remitente,
          notas: notaDeOrigen(evento, aliasUsado, extracto),
          actorId: options.actorId,
        })

        await subirArchivoAFactura(admin, {
          facturaId,
          archivo: {
            nombre: adjunto.filename || "factura.pdf",
            contenido_base64: contenido.toString("base64"),
            tipo_mime: adjunto.content_type,
            descripcion: `Recibido por correo de ${evento.remitente ?? "un remitente desconocido"}`,
            bucket: "facturas",
          },
          actorId: options.actorId,
          limiteBytes: MAX_BYTES_ADJUNTO_EMAIL,
        })

        creadas.push(facturaId)
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err)
        console.warn(`Adjunto '${adjunto.filename}' descartado:`, mensaje)
        problemas.push(`'${adjunto.filename}': ${mensaje}`)
      }
    }

    // 4) Correo sin ningún adjunto aprovechable: se registra igualmente una
    //    factura con el asunto y el cuerpo. Es preferible una fila que alguien
    //    borra a un correo que se pierde en silencio.
    if (creadas.length === 0) {
      const facturaId = await crearFacturaDeCorreo(admin, {
        delegacionId: delegacion.id,
        concepto: evento.asunto,
        remitente: evento.remitente,
        notas: notaDeOrigen(evento, aliasUsado, extracto, true),
        actorId: options.actorId,
      })
      creadas.push(facturaId)

      await actualizarRegistro(admin, registroId, {
        delegacion_id: delegacion.id,
        alias_detectado: aliasUsado,
        estado: "sin_adjuntos",
        error: problemas.join(" · ") || null,
        facturas_creadas: 1,
        cuerpo_extracto: extracto,
      })
      return {
        estado: "sin_adjuntos",
        delegacionId: delegacion.id,
        facturasCreadas: creadas,
        mensaje: "El correo no traía adjuntos legibles; se ha guardado su contenido.",
      }
    }

    await actualizarRegistro(admin, registroId, {
      delegacion_id: delegacion.id,
      alias_detectado: aliasUsado,
      estado: "procesado",
      error: problemas.join(" · ") || null,
      facturas_creadas: creadas.length,
      cuerpo_extracto: extracto,
    })

    return {
      estado: "procesado",
      delegacionId: delegacion.id,
      facturasCreadas: creadas,
      mensaje: `${creadas.length} factura(s) en la bandeja de ${delegacion.nombre}.`,
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    console.error("Error procesando un correo entrante:", mensaje)
    await actualizarRegistro(admin, registroId, {
      estado: "error",
      error: mensaje.slice(0, 500),
    }).catch(() => undefined)
    return { estado: "error", delegacionId: null, facturasCreadas: [], mensaje }
  }
}

function notaDeOrigen(
  evento: EventoEmailRecibido,
  alias: string,
  extracto: string | null,
  incluirCuerpo = false,
): string {
  const lineas = [
    `Recibida por correo en ${buzonFacturas()}+${alias}@`,
    `De: ${evento.remitente ?? "desconocido"}`,
    evento.asunto ? `Asunto: ${evento.asunto}` : null,
  ].filter(Boolean) as string[]

  if (incluirCuerpo && extracto) {
    lineas.push("", "Contenido del correo:", extracto.slice(0, 2000))
  }
  return lineas.join("\n")
}

async function crearFacturaDeCorreo(
  admin: AdminClient,
  params: {
    delegacionId: string
    concepto: string | null
    remitente: string | null
    notas: string
    actorId: string
  },
): Promise<string> {
  const fila = unwrap(
    await (admin as any)
      .from("factura")
      .insert({
        delegacion_id: params.delegacionId,
        concepto: params.concepto?.trim().slice(0, 160) || null,
        estado: "bandeja",
        origen: "email",
        email_remitente: params.remitente?.slice(0, 200) ?? null,
        notas: params.notas,
        creado_por: params.actorId,
      })
      .select("id")
      .single(),
  ) as any
  return fila.id
}

async function actualizarRegistro(
  admin: AdminClient,
  id: string,
  cambios: Record<string, unknown>,
): Promise<void> {
  const { error } = await (admin as any).from("factura_email").update(cambios).eq("id", id)
  if (error) console.warn("No se pudo actualizar el registro del correo:", error.message)
}
