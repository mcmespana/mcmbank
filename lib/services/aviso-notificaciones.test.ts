import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"
import { enviarNotificacionAviso, type AvisoNotificable } from "@/lib/services/aviso-notificaciones"

/**
 * Envío por correo de un aviso. Lo que hay que comprobar no es que Resend
 * funcione (eso no se puede probar sin red), sino a quién se decide
 * escribir: tesoreros o gestores centrales según el destinatario, nunca al
 * propio autor, y qué pasa cuando no hay nadie a quien avisar o no hay
 * correo configurado.
 */

const SEV_ID = "aaaaaaaa-0000-0000-0000-000000000001"
const ACTOR = "autor-1"

function avisoBase(over: Partial<AvisoNotificable> = {}): AvisoNotificable {
  return {
    id: "aviso-1",
    delegacion_id: SEV_ID,
    tipo: "nota",
    contenido: "Falta la factura de octubre",
    referencia: null,
    destinatario: "delegacion",
    creado_por: ACTOR,
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    membresia: [],
    delegacion: [{ id: SEV_ID, codigo: "SEV", nombre: "Sevilla" }],
    perfil: [],
    aviso: [{ id: "aviso-1" }],
    ...extra,
  }
}

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key"
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, text: async () => "" } as Response),
  )
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
  vi.unstubAllGlobals()
})

describe("enviarNotificacionAviso · configuración", () => {
  it("sin RESEND_API_KEY, falla con 503 y no llega a consultar nada", async () => {
    delete process.env.RESEND_API_KEY
    const admin = crearFakeAdmin(tablas()) as any
    await expect(enviarNotificacionAviso(admin, avisoBase())).rejects.toMatchObject({ status: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("enviarNotificacionAviso · a quién se avisa", () => {
  it("dirigido a la delegación, avisa a sus tesoreros por correo", async () => {
    const admin = crearFakeAdmin(
      tablas({
        membresia: [
          { usuario_id: "tesorero-sev", delegacion_id: SEV_ID, rol: "tesorero" },
          { usuario_id: "tesorero-mad", delegacion_id: "otra-delegacion", rol: "tesorero" },
        ],
        usuarios: [{ id: "tesorero-sev", email: "tesorero@sevilla.example" }] as any,
      }),
    ) as any
    admin.auth.admin.listUsers = async () => ({
      data: { users: [{ id: "tesorero-sev", email: "tesorero@sevilla.example" }] },
      error: null,
    })

    const resultado = await enviarNotificacionAviso(admin, avisoBase())
    expect(resultado.destinatarios).toEqual(["tesorero@sevilla.example"])

    const llamada = (fetch as any).mock.calls[0]
    const cuerpo = JSON.parse(llamada[1].body)
    expect(cuerpo.to).toEqual(["tesorero@sevilla.example"])
  })

  it("dirigido a la oficina técnica, avisa a los gestores centrales", async () => {
    const admin = crearFakeAdmin(
      tablas({
        membresia: [
          { usuario_id: "gestor-1", delegacion_id: SEV_ID, rol: "gestor_central" },
          { usuario_id: "tesorero-sev", delegacion_id: SEV_ID, rol: "tesorero" },
        ],
      }),
    ) as any
    admin.auth.admin.listUsers = async () => ({
      data: { users: [{ id: "gestor-1", email: "gestor@central.example" }] },
      error: null,
    })

    const resultado = await enviarNotificacionAviso(
      admin,
      avisoBase({ destinatario: "oficina_tecnica" }),
    )
    expect(resultado.destinatarios).toEqual(["gestor@central.example"])
  })

  it("nunca se avisa al propio autor, aunque cumpla el rol", async () => {
    const admin = crearFakeAdmin(
      tablas({
        membresia: [{ usuario_id: ACTOR, delegacion_id: SEV_ID, rol: "tesorero" }],
      }),
    ) as any
    admin.auth.admin.listUsers = async () => ({
      data: { users: [{ id: ACTOR, email: "autor@sevilla.example" }] },
      error: null,
    })

    await expect(enviarNotificacionAviso(admin, avisoBase())).rejects.toMatchObject({ status: 409 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sin ningún tesorero en la delegación, error 409 explicando por qué", async () => {
    const admin = crearFakeAdmin(tablas()) as any
    await expect(enviarNotificacionAviso(admin, avisoBase())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("tesorero"),
    })
  })

  it("si los destinatarios no tienen correo, también 409", async () => {
    const admin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "tesorero-sev", delegacion_id: SEV_ID, rol: "tesorero" }] }),
    ) as any
    admin.auth.admin.listUsers = async () => ({ data: { users: [] }, error: null })

    await expect(enviarNotificacionAviso(admin, avisoBase())).rejects.toMatchObject({ status: 409 })
  })
})

describe("enviarNotificacionAviso · correo y sellado", () => {
  function adminConTesorero() {
    const admin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "tesorero-sev", delegacion_id: SEV_ID, rol: "tesorero" }] }),
    ) as any
    admin.auth.admin.listUsers = async () => ({
      data: { users: [{ id: "tesorero-sev", email: "tesorero@sevilla.example" }] },
      error: null,
    })
    return admin
  }

  it("si Resend devuelve un error HTTP, se traduce en un 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "clave inválida" } as Response),
    )
    const admin = adminConTesorero()
    await expect(enviarNotificacionAviso(admin, avisoBase())).rejects.toMatchObject({ status: 502 })
  })

  it("si el envío sale bien, sella el aviso con quién lo notificó", async () => {
    const admin = adminConTesorero()
    await enviarNotificacionAviso(admin, avisoBase(), { marcarNotificadoPor: "quien-reenvia" })
    const escritura = admin.escrituras.find((e: any) => e.tabla === "aviso" && e.tipo === "update")
    expect(escritura?.valores?.notificado_por).toBe("quien-reenvia")
    expect(escritura?.valores?.notificado_en).toBeTruthy()
  })

  it("sin indicar quién reenvía, sella con el autor original", async () => {
    const admin = adminConTesorero()
    await enviarNotificacionAviso(admin, avisoBase())
    const escritura = admin.escrituras.find((e: any) => e.tabla === "aviso" && e.tipo === "update")
    expect(escritura?.valores?.notificado_por).toBe(ACTOR)
  })
})
