import { createHmac } from "node:crypto"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  aliasesDeDestinatarios,
  parsearEventoResend,
  renderNotificacionSinDelegacion,
  verificarFirmaResend,
} from "./facturas-email"

/**
 * El buzón de facturas es la única entrada no autenticada de la app, así que
 * lo que se prueba aquí es justo eso: que la firma no se pueda saltar y que la
 * dirección se traduzca a la delegación correcta pase lo que pase por el camino
 * (reenvíos, mayúsculas, nombres con ángulos).
 */

const SECRETO = `whsec_${Buffer.from("un-secreto-de-prueba-para-firmar").toString("base64")}`

function firmar(cuerpo: string, id: string, timestamp: string, secreto = SECRETO): string {
  const clave = Buffer.from(secreto.replace("whsec_", ""), "base64")
  return `v1,${createHmac("sha256", clave).update(`${id}.${timestamp}.${cuerpo}`).digest("base64")}`
}

describe("verificarFirmaResend", () => {
  const ahora = new Date("2026-08-14T10:00:00Z")
  const timestamp = String(Math.floor(ahora.getTime() / 1000))
  const cuerpo = JSON.stringify({ type: "email.received" })

  it("acepta una firma correcta", () => {
    const firma = firmar(cuerpo, "msg_1", timestamp)
    expect(
      verificarFirmaResend(cuerpo, { id: "msg_1", timestamp, signature: firma }, SECRETO, ahora),
    ).toEqual({ ok: true })
  })

  it("acepta si una de varias firmas encaja (rotación de secreto)", () => {
    const buena = firmar(cuerpo, "msg_1", timestamp)
    expect(
      verificarFirmaResend(
        cuerpo,
        { id: "msg_1", timestamp, signature: `v1,cXVlLXZhLGVzdG8= ${buena}` },
        SECRETO,
        ahora,
      ),
    ).toEqual({ ok: true })
  })

  it("rechaza un cuerpo manipulado", () => {
    const firma = firmar(cuerpo, "msg_1", timestamp)
    const resultado = verificarFirmaResend(
      `${cuerpo} `,
      { id: "msg_1", timestamp, signature: firma },
      SECRETO,
      ahora,
    )
    expect(resultado.ok).toBe(false)
  })

  it("rechaza una firma hecha con otro secreto", () => {
    const otro = `whsec_${Buffer.from("otro-secreto-distinto-del-bueno").toString("base64")}`
    const firma = firmar(cuerpo, "msg_1", timestamp, otro)
    expect(
      verificarFirmaResend(cuerpo, { id: "msg_1", timestamp, signature: firma }, SECRETO, ahora).ok,
    ).toBe(false)
  })

  it("rechaza una firma vieja (reenvío)", () => {
    const viejo = String(Math.floor(ahora.getTime() / 1000) - 3600)
    const firma = firmar(cuerpo, "msg_1", viejo)
    expect(
      verificarFirmaResend(cuerpo, { id: "msg_1", timestamp: viejo, signature: firma }, SECRETO, ahora).ok,
    ).toBe(false)
  })

  it("rechaza si faltan cabeceras", () => {
    expect(
      verificarFirmaResend(cuerpo, { id: null, timestamp, signature: "v1,x" }, SECRETO, ahora).ok,
    ).toBe(false)
  })
})

describe("aliasesDeDestinatarios", () => {
  const original = process.env.FACTURAS_EMAIL_LOCAL
  beforeEach(() => {
    delete process.env.FACTURAS_EMAIL_LOCAL
  })
  afterEach(() => {
    if (original === undefined) delete process.env.FACTURAS_EMAIL_LOCAL
    else process.env.FACTURAS_EMAIL_LOCAL = original
  })

  it("saca la etiqueta del sub-direccionamiento", () => {
    expect(aliasesDeDestinatarios(["facturas+castellon@movimientoconsolacion.com"])).toEqual([
      "castellon",
    ])
  })

  it("admite el guion para proveedores que no aceptan '+'", () => {
    expect(aliasesDeDestinatarios(["facturas-ece@movimientoconsolacion.com"])).toEqual(["ece"])
  })

  it("admite el buzón en subdominio", () => {
    expect(aliasesDeDestinatarios(["madrid@facturas.movimientoconsolacion.com"])).toEqual(["madrid"])
  })

  it("ignora el buzón sin etiqueta y las direcciones de fuera", () => {
    expect(
      aliasesDeDestinatarios([
        "facturas@movimientoconsolacion.com",
        "info@movimientoconsolacion.com",
        "proveedor@ejemplo.es",
      ]),
    ).toEqual([])
  })

  it("quita el nombre y las mayúsculas", () => {
    expect(
      aliasesDeDestinatarios(["Facturas MCM <FACTURAS+Vila-Real@MovimientoConsolacion.com>"]),
    ).toEqual(["vila-real"])
  })

  it("encuentra la etiqueta aunque el correo venga reenviado", () => {
    // El envelope apunta al buzón de Resend; la dirección real solo sobrevive
    // en la cabecera original.
    expect(
      aliasesDeDestinatarios([
        "entrada@id123.resend.app",
        "facturas+zaragoza@movimientoconsolacion.com",
      ]),
    ).toEqual(["zaragoza"])
  })

  it("no repite etiquetas ni deja caracteres raros", () => {
    expect(
      aliasesDeDestinatarios([
        "facturas+onda@movimientoconsolacion.com",
        "facturas+onda@movimientoconsolacion.com",
        "facturas+on da!@movimientoconsolacion.com",
      ]),
    ).toEqual(["onda"])
  })

  it("respeta FACTURAS_EMAIL_LOCAL", () => {
    process.env.FACTURAS_EMAIL_LOCAL = "recibos"
    expect(aliasesDeDestinatarios(["recibos+nules@movimientoconsolacion.com"])).toEqual(["nules"])
  })
})

describe("parsearEventoResend", () => {
  it("recoge todos los destinatarios conocidos", () => {
    const evento = parsearEventoResend({
      type: "email.received",
      created_at: "2026-08-14T09:00:00Z",
      data: {
        email_id: "em_1",
        message_id: "<abc@ejemplo>",
        from: "proveedor@ejemplo.es",
        to: ["facturas+onda@movimientoconsolacion.com"],
        cc: ["copia@ejemplo.es"],
        received_for: ["entrada@id.resend.app"],
        subject: "Factura de marzo",
      },
    })
    expect(evento?.emailId).toBe("em_1")
    expect(evento?.destinatarios).toHaveLength(3)
    expect(evento?.asunto).toBe("Factura de marzo")
  })

  it("ignora otros eventos", () => {
    expect(parsearEventoResend({ type: "email.delivered", data: { email_id: "em_1" } })).toBeNull()
    expect(parsearEventoResend({ type: "email.received", data: {} })).toBeNull()
  })
})

describe("renderNotificacionSinDelegacion", () => {
  it("incluye el remitente, el asunto y la guía de alias, y escapa el HTML", () => {
    const html = renderNotificacionSinDelegacion({
      remitente: "Proveedor <malo@ejemplo.es>",
      asunto: "Factura <script>alert(1)</script>",
      buzon: "facturas@movimientoconsolacion.com",
    })
    expect(html).toContain("Proveedor &lt;malo@ejemplo.es&gt;")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("facturas@movimientoconsolacion.com")
    expect(html).toContain("facturas+aj@")
  })

  it("no revienta sin remitente ni asunto", () => {
    const html = renderNotificacionSinDelegacion({
      remitente: null,
      asunto: null,
      buzon: "facturas@movimientoconsolacion.com",
    })
    expect(html).toContain("un remitente desconocido")
  })
})
