import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"
import { procesarCorreoEntrante, resolverDelegacionPorAlias, type EventoEmailRecibido } from "@/lib/api/facturas-email"

/**
 * `procesarCorreoEntrante` es lo que convierte un correo real —el buzón de
 * facturas no está autenticado, cualquiera puede escribirle— en filas de
 * `factura`. Lo que importa no es Resend (no hay red en los tests), sino que
 * nunca lance (el webhook necesita un 200 aunque el correo no se pueda
 * encaminar), que un reintento de Resend no duplique la factura, que un
 * correo sin delegación reconocible avise a la oficina técnica en vez de
 * perderse, que los adjuntos se filtren (tipo, tamaño, imágenes de firma) y
 * que un adjunto roto no tire abajo los demás.
 */

const EMAIL_ID = "email-123"
const ACTOR = "11111111-1111-1111-1111-111111111111"
const SEV = { id: "sev-1", nombre: "Sevilla", codigo: "SEV", alias_email: "sevilla" }

function evento(over: Partial<EventoEmailRecibido> = {}): EventoEmailRecibido {
  return {
    emailId: EMAIL_ID,
    messageId: "msg-1",
    remitente: "proveedor@ejemplo.com",
    destinatarios: ["facturas+sevilla@movimientoconsolacion.com"],
    asunto: "Factura de octubre",
    recibidoEn: "2026-03-10T10:00:00Z",
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV],
    factura_email: [],
    factura: [],
    archivo_adjunto: [],
    movimiento: [],
    ...extra,
  }
}

function storageDeMentira() {
  return {
    from: () => ({
      upload: async (path: string) => ({ data: { path }, error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: "https://x.test" }, error: null }),
    }),
  }
}

function admin(t: Tablas = tablas(), opciones?: Parameters<typeof crearFakeAdmin>[1]) {
  const a = crearFakeAdmin(t, opciones) as any
  a.storage = storageDeMentira()
  return a
}

/** Router de fetch que sirve los tres endpoints de Resend que usa el módulo. */
function fetchDeMentira(config: {
  cuerpo?: { text?: string | null; html?: string | null; headers?: Record<string, unknown> }
  adjuntos?: { id: string; filename: string; content_type: string; size?: number; download_url: string }[]
  contenidos?: Record<string, string> // download_url -> contenido en texto
  fallaDescargaDe?: string // download_url que debe fallar
}) {
  const llamadasNotificacion: any[] = []
  const fn = vi.fn(async (url: string) => {
    if (url.endsWith(`/emails/receiving/${EMAIL_ID}/attachments`)) {
      return { ok: true, json: async () => config.adjuntos ?? [] }
    }
    if (url.endsWith(`/emails/receiving/${EMAIL_ID}`)) {
      return {
        ok: true,
        json: async () => ({
          text: config.cuerpo?.text ?? null,
          html: config.cuerpo?.html ?? null,
          headers: config.cuerpo?.headers ?? {},
        }),
      }
    }
    if (url === "https://api.resend.com/emails") {
      llamadasNotificacion.push(url)
      return { ok: true, json: async () => ({ id: "sent" }), text: async (): Promise<string> => "" }
    }
    if (config.fallaDescargaDe && url === config.fallaDescargaDe) {
      return { ok: false, status: 500, text: async () => "fallo simulado de red" }
    }
    if (config.contenidos && url in config.contenidos) {
      const texto = config.contenidos[url]
      return { ok: true, arrayBuffer: async () => Buffer.from(texto).buffer }
    }
    throw new Error(`URL no simulada en el test: ${url}`)
  })
  return { fn, llamadasNotificacion }
}

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key"
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------

describe("procesarCorreoEntrante · idempotencia", () => {
  it("un correo ya procesado (reintento de Resend) se marca 'duplicado' sin volver a nada", async () => {
    const a = admin(tablas(), { errores: { factura_email: { message: "duplicate key", code: "23505" } } })
    const { fn } = fetchDeMentira({})
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })

    expect(res).toEqual({
      estado: "duplicado",
      delegacionId: null,
      facturasCreadas: [],
      mensaje: "Este correo ya se había procesado.",
    })
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("procesarCorreoEntrante · sin delegación reconocible", () => {
  it("avisa a la oficina técnica y adjunta lo que mandó el remitente", async () => {
    const a = admin(tablas({ delegacion: [] })) // ninguna delegación coincide
    const { fn, llamadasNotificacion } = fetchDeMentira({
      adjuntos: [
        { id: "a1", filename: "factura.pdf", content_type: "application/pdf", size: 50_000, download_url: "https://dl/a1" },
      ],
      contenidos: { "https://dl/a1": "contenido-pdf" },
    })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })

    expect(res.estado).toBe("sin_delegacion")
    expect(res.delegacionId).toBeNull()
    expect(a.tablas.factura_email[0].estado).toBe("sin_delegacion")
    expect(llamadasNotificacion).toHaveLength(1)
    expect(a.tablas.factura).toHaveLength(0) // no hay dónde colgarla
  })

  it("si tampoco hay RESEND_API_KEY, no revienta: solo se queda sin avisar", async () => {
    delete process.env.RESEND_API_KEY
    const a = admin(tablas({ delegacion: [] }))
    const { fn } = fetchDeMentira({ adjuntos: [] })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    expect(res.estado).toBe("sin_delegacion")
  })
})

describe("procesarCorreoEntrante · con delegación y adjuntos válidos", () => {
  it("crea una factura por cada adjunto aprovechable", async () => {
    const a = admin()
    const { fn } = fetchDeMentira({
      adjuntos: [
        { id: "a1", filename: "factura1.pdf", content_type: "application/pdf", size: 50_000, download_url: "https://dl/a1" },
        { id: "a2", filename: "factura2.pdf", content_type: "application/pdf", size: 60_000, download_url: "https://dl/a2" },
      ],
      contenidos: { "https://dl/a1": "contenido-1", "https://dl/a2": "contenido-2" },
    })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })

    expect(res.estado).toBe("procesado")
    expect(res.delegacionId).toBe(SEV.id)
    expect(res.facturasCreadas).toHaveLength(2)
    expect(a.tablas.factura).toHaveLength(2)
    expect(a.tablas.factura[0]).toMatchObject({
      delegacion_id: SEV.id,
      estado: "bandeja",
      origen: "email",
      email_remitente: "proveedor@ejemplo.com",
      concepto: "Factura de octubre",
    })
    expect(a.tablas.archivo_adjunto).toHaveLength(2)
    expect(a.tablas.factura_email[0]).toMatchObject({ estado: "procesado", delegacion_id: SEV.id, facturas_creadas: 2 })
  })

  it("descarta imágenes diminutas (logos de firma) pero acepta un PDF junto a ellas", async () => {
    const a = admin()
    const { fn } = fetchDeMentira({
      adjuntos: [
        { id: "logo", filename: "logo.png", content_type: "image/png", size: 2_000, download_url: "https://dl/logo" },
        { id: "pdf", filename: "factura.pdf", content_type: "application/pdf", size: 80_000, download_url: "https://dl/pdf" },
      ],
      contenidos: { "https://dl/pdf": "contenido-factura" },
    })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    expect(res.facturasCreadas).toHaveLength(1)
    // El logo nunca se llega a descargar (se filtra antes, por tamaño).
    expect(fn.mock.calls.some((c) => c[0] === "https://dl/logo")).toBe(false)
  })

  it("un tipo de archivo no aceptado (p.ej. un .zip) no genera factura", async () => {
    const a = admin()
    const { fn } = fetchDeMentira({
      adjuntos: [{ id: "z1", filename: "cosas.zip", content_type: "application/zip", size: 10_000, download_url: "https://dl/z1" }],
    })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    // Sin nada que colgar, se guarda una factura con el cuerpo/asunto.
    expect(res.estado).toBe("sin_adjuntos")
    expect(res.facturasCreadas).toHaveLength(1)
  })

  it("si la descarga del único adjunto falla, se guarda igualmente una factura con el asunto/cuerpo", async () => {
    const a = admin()
    const { fn } = fetchDeMentira({
      adjuntos: [{ id: "f1", filename: "rota.pdf", content_type: "application/pdf", size: 10_000, download_url: "https://dl/f1" }],
      fallaDescargaDe: "https://dl/f1",
    })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    expect(res.estado).toBe("sin_adjuntos")
    expect(res.mensaje).toContain("no traía adjuntos legibles")
    expect(a.tablas.factura_email[0].error).toContain("rota.pdf")
  })

  it("un adjunto roto no impide que los demás se procesen", async () => {
    const a = admin()
    const conFalloYbueno = fetchDeMentira({
      adjuntos: [
        { id: "roto", filename: "roto.pdf", content_type: "application/pdf", size: 10_000, download_url: "https://dl/roto" },
        { id: "bueno", filename: "bueno.pdf", content_type: "application/pdf", size: 10_000, download_url: "https://dl/bueno" },
      ],
      contenidos: { "https://dl/bueno": "contenido-bueno" },
      fallaDescargaDe: "https://dl/roto",
    })
    vi.stubGlobal("fetch", conFalloYbueno.fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    expect(res.estado).toBe("procesado")
    expect(res.facturasCreadas).toHaveLength(1)
    expect(a.tablas.factura_email[0].error).toContain("roto.pdf")
  })
})

describe("procesarCorreoEntrante · nunca lanza", () => {
  it("un fallo inesperado al resolver la delegación se registra como error, no revienta el webhook", async () => {
    const a = admin(tablas(), { errores: { delegacion: { message: "la base de datos no responde" } } })
    const { fn } = fetchDeMentira({ adjuntos: [] })
    vi.stubGlobal("fetch", fn)

    const res = await procesarCorreoEntrante(a, evento(), { actorId: ACTOR })
    expect(res.estado).toBe("error")
    expect(res.mensaje).toContain("no responde")
    expect(a.tablas.factura_email[0].estado).toBe("error")
  })
})

// ---------------------------------------------------------------------------

describe("resolverDelegacionPorAlias", () => {
  it("resuelve primero por alias_email", async () => {
    const a = admin(tablas({ delegacion: [SEV, { id: "mad", nombre: "Madrid", codigo: "MAD", alias_email: null }] }))
    const resultado = await resolverDelegacionPorAlias(a, ["sevilla"])
    expect(resultado?.delegacion.id).toBe(SEV.id)
  })

  it("si ninguna alias_email coincide, prueba por código", async () => {
    const a = admin(tablas({ delegacion: [{ id: "mad", nombre: "Madrid", codigo: "MAD", alias_email: null }] }))
    const resultado = await resolverDelegacionPorAlias(a, ["mad"])
    expect(resultado?.delegacion.id).toBe("mad")
  })

  it("sin ninguna coincidencia, devuelve null", async () => {
    const a = admin(tablas({ delegacion: [SEV] }))
    expect(await resolverDelegacionPorAlias(a, ["cuenca"])).toBeNull()
  })

  it("una lista de alias vacía no llega a consultar nada", async () => {
    const a = admin()
    const resultado = await resolverDelegacionPorAlias(a, [])
    expect(resultado).toBeNull()
    expect(a.consultas).toHaveLength(0)
  })
})
