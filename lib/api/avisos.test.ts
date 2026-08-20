import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Avisos y tareas: el canal entre la oficina técnica y los tesoreros de cada
 * delegación. Lo que importa comprobar es la validación (un aviso vacío o
 * gigante, un tipo inventado), que los campos propios de una tarea
 * (responsable, fecha límite, urgente) no se cuelen en una nota, que
 * "asignables" filtre por el lado correcto (tesoreros vs. gestores
 * centrales) y que un fallo al enviar el correo no se lleve por delante el
 * aviso ya guardado.
 */

vi.mock("@/lib/services/aviso-notificaciones", () => ({
  enviarNotificacionAviso: vi.fn(),
}))

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }
const ACTOR = "11111111-1111-1111-1111-111111111111"

let n = 0
function aviso(over: Record<string, any> = {}) {
  return {
    id: `aviso-${++n}`,
    delegacion_id: SEV.id,
    tipo: "nota",
    contenido: "Falta la factura de octubre",
    referencia: null,
    destinatario: "delegacion",
    estado: "pendiente",
    completado_por: null,
    completado_en: null,
    notificado_en: null,
    notificado_por: null,
    responsable_id: null,
    fecha_limite: null,
    urgente: false,
    creado_por: ACTOR,
    creado_en: "2026-03-01T00:00:00Z",
    actualizado_en: "2026-03-01T00:00:00Z",
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    aviso: [],
    aviso_lectura: [],
    perfil: [],
    membresia: [],
    ...extra,
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  n = 0
})

async function api(t: Tablas = tablas()) {
  const mod = await import("@/lib/api/avisos")
  const notificaciones = await import("@/lib/services/aviso-notificaciones")
  return { mod, admin: crearFakeAdmin(t) as any, notificaciones }
}

// ---------------------------------------------------------------------------

describe("crearAviso · validación", () => {
  it("rechaza el contenido vacío", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "   " }, ACTOR),
    ).rejects.toThrow("no puede estar vacío")
  })

  it("rechaza un contenido demasiado largo", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "x".repeat(2001) }, ACTOR),
    ).rejects.toThrow("máximo")
  })

  it("rechaza un tipo inventado y publica los válidos", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola", tipo: "recordatorio" as any }, ACTOR),
    ).rejects.toMatchObject({ status: 400, detalles: { tipos_validos: expect.any(Array) } })
  })

  it("rechaza un destinatario inventado", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearAviso(
        admin,
        { delegacion: "Sevilla", contenido: "hola", destinatario: "todos" as any },
        ACTOR,
      ),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("rechaza una fecha_limite con formato inválido", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearAviso(
        admin,
        { delegacion: "Sevilla", contenido: "hola", tipo: "tarea", fecha_limite: "01/03/2026" },
        ACTOR,
      ),
    ).rejects.toThrow("AAAA-MM-DD")
  })

  it("una delegación inexistente no llega a insertar nada", async () => {
    const { mod, admin } = await api()
    await expect(mod.crearAviso(admin, { delegacion: "Cuenca", contenido: "hola" }, ACTOR)).rejects.toThrow()
    expect(admin.tablas.aviso).toHaveLength(0)
  })
})

describe("crearAviso · valores por defecto y campos de tarea", () => {
  it("por defecto es una nota dirigida a la delegación", async () => {
    const { mod, admin } = await api()
    const { aviso: creado } = await mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola" }, ACTOR)
    expect(creado.tipo).toBe("nota")
    expect(creado.destinatario).toBe("delegacion")
  })

  it("una nota ignora responsable, fecha_limite y urgente aunque se manden", async () => {
    const { mod, admin } = await api()
    await mod.crearAviso(
      admin,
      {
        delegacion: "Sevilla",
        contenido: "hola",
        tipo: "nota",
        responsable_id: "user-x",
        fecha_limite: "2026-04-01",
        urgente: true,
      },
      ACTOR,
    )
    const fila = admin.tablas.aviso[0]
    expect(fila.responsable_id).toBeNull()
    expect(fila.fecha_limite).toBeNull()
    expect(fila.urgente).toBe(false)
  })

  it("una tarea sí guarda responsable, fecha_limite y urgente", async () => {
    const { mod, admin } = await api()
    await mod.crearAviso(
      admin,
      {
        delegacion: "Sevilla",
        contenido: "Rellenar el anexo",
        tipo: "tarea",
        responsable_id: "user-x",
        fecha_limite: "2026-04-01",
        urgente: true,
      },
      ACTOR,
    )
    const fila = admin.tablas.aviso[0]
    expect(fila.responsable_id).toBe("user-x")
    expect(fila.fecha_limite).toBe("2026-04-01")
    expect(fila.urgente).toBe(true)
  })

  it("recorta la referencia al máximo permitido", async () => {
    const { mod, admin } = await api()
    await mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola", referencia: "x".repeat(100) }, ACTOR)
    expect(admin.tablas.aviso[0].referencia).toHaveLength(60)
  })
})

describe("crearAviso · notificación por correo", () => {
  it("si se pide notificar y sale bien, devuelve a quién se avisó", async () => {
    const { mod, admin, notificaciones } = await api()
    vi.mocked(notificaciones.enviarNotificacionAviso).mockResolvedValue({
      destinatarios: ["tesorero@sevilla.example"],
    })
    const res = await mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola", notificar: true }, ACTOR)
    expect(res.notificados).toEqual(["tesorero@sevilla.example"])
    expect(res.aviso_notificacion).toBeUndefined()
  })

  it("si el correo falla, el aviso sigue creado y se explica qué pasó", async () => {
    const { mod, admin, notificaciones } = await api()
    vi.mocked(notificaciones.enviarNotificacionAviso).mockRejectedValue(new Error("RESEND_API_KEY no está configurada"))
    const res = await mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola", notificar: true }, ACTOR)
    expect(res.aviso).toBeDefined()
    expect(admin.tablas.aviso).toHaveLength(1)
    expect(res.aviso_notificacion).toContain("RESEND_API_KEY")
  })

  it("sin pedir notificar, no se llama al servicio de correo", async () => {
    const { mod, admin, notificaciones } = await api()
    await mod.crearAviso(admin, { delegacion: "Sevilla", contenido: "hola" }, ACTOR)
    expect(notificaciones.enviarNotificacionAviso).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe("actualizarAviso", () => {
  it("un aviso inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.actualizarAviso(admin, "no-existe", { contenido: "x" }, ACTOR)).rejects.toMatchObject({
      status: 404,
    })
  })

  it("sin ningún cambio, avisa en vez de escribir en vacío", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    await expect(mod.actualizarAviso(admin, "aviso-1", {}, ACTOR)).rejects.toThrow("ningún cambio")
  })

  it("pasar a 'hecha' registra quién la completó", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    const actualizado = await mod.actualizarAviso(admin, "aviso-1", { estado: "hecha" }, ACTOR)
    expect(actualizado.estado).toBe("hecha")
    expect(admin.tablas.aviso[0].completado_por).toBe(ACTOR)
  })

  it("volver a 'pendiente' quita quién la había completado", async () => {
    const { mod, admin } = await api(
      tablas({ aviso: [aviso({ estado: "hecha", completado_por: ACTOR })] }),
    )
    await mod.actualizarAviso(admin, "aviso-1", { estado: "pendiente" }, ACTOR)
    expect(admin.tablas.aviso[0].completado_por).toBeNull()
  })

  it("rechaza un estado inventado", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    await expect(
      mod.actualizarAviso(admin, "aviso-1", { estado: "archivada" as any }, ACTOR),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("un contenido vaciado al editar también se rechaza", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    await expect(mod.actualizarAviso(admin, "aviso-1", { contenido: "   " }, ACTOR)).rejects.toThrow(
      "no puede quedarse vacío",
    )
  })

  it("permite quitar la referencia poniéndola a null", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso({ referencia: "F-2026-1" })] }))
    await mod.actualizarAviso(admin, "aviso-1", { referencia: null }, ACTOR)
    expect(admin.tablas.aviso[0].referencia).toBeNull()
  })

  it("rechaza una fecha_limite con formato inválido al editar", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso({ tipo: "tarea" })] }))
    await expect(
      mod.actualizarAviso(admin, "aviso-1", { fecha_limite: "no es una fecha" }, ACTOR),
    ).rejects.toThrow("AAAA-MM-DD")
  })
})

// ---------------------------------------------------------------------------

describe("listarAvisos", () => {
  it("por defecto solo trae los pendientes", async () => {
    const { mod, admin } = await api(
      tablas({ aviso: [aviso({ id: "a-pend" }), aviso({ id: "a-hecha", estado: "hecha" })] }),
    )
    const res = await mod.listarAvisos(admin)
    expect(res.avisos.map((a) => a.id)).toEqual(["a-pend"])
  })

  it("con estado 'todas' no filtra por estado", async () => {
    const { mod, admin } = await api(
      tablas({ aviso: [aviso({ id: "a-pend" }), aviso({ id: "a-hecha", estado: "hecha" })] }),
    )
    const res = await mod.listarAvisos(admin, { estado: "todas" })
    expect(res.avisos).toHaveLength(2)
  })

  it("filtra por tipo y por destinatario", async () => {
    const { mod, admin } = await api(
      tablas({
        aviso: [
          aviso({ id: "a-tarea", tipo: "tarea" }),
          aviso({ id: "a-nota-oficina", destinatario: "oficina_tecnica" }),
        ],
      }),
    )
    const porTipo = await mod.listarAvisos(admin, { tipo: "tarea", estado: "todas" })
    expect(porTipo.avisos.map((a) => a.id)).toEqual(["a-tarea"])

    const porDestinatario = await mod.listarAvisos(admin, {
      destinatario: "oficina_tecnica",
      estado: "todas",
    })
    expect(porDestinatario.avisos.map((a) => a.id)).toEqual(["a-nota-oficina"])
  })

  it("filtra por texto dentro del contenido", async () => {
    const { mod, admin } = await api(
      tablas({ aviso: [aviso({ id: "a-factura", contenido: "Falta la factura de luz" })] }),
    )
    const res = await mod.listarAvisos(admin, { texto: "factura" })
    expect(res.avisos.map((a) => a.id)).toEqual(["a-factura"])
  })

  it("solo enseña avisos de las delegaciones pedidas", async () => {
    const { mod, admin } = await api(
      tablas({ aviso: [aviso({ id: "a-sev" }), aviso({ id: "a-mad", delegacion_id: MAD.id })] }),
    )
    const res = await mod.listarAvisos(admin, { delegaciones: "Madrid" })
    expect(res.avisos.map((a) => a.id)).toEqual(["a-mad"])
  })
})

describe("obtenerAviso", () => {
  it("un id inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.obtenerAviso(admin, "no-existe")).rejects.toMatchObject({ status: 404 })
  })
})

// ---------------------------------------------------------------------------

describe("listarAsignablesAviso", () => {
  it("para un aviso dirigido a la delegación, solo tesoreros de esa delegación", async () => {
    const { mod, admin } = await api(
      tablas({
        membresia: [
          { usuario_id: "tesorero-sev", delegacion_id: SEV.id, rol: "tesorero" },
          { usuario_id: "tesorero-mad", delegacion_id: MAD.id, rol: "tesorero" },
          { usuario_id: "gestor-1", delegacion_id: SEV.id, rol: "gestor_central" },
        ],
      }),
    )
    const res = await mod.listarAsignablesAviso(admin, "Sevilla", "delegacion")
    expect(res.map((a) => a.id)).toEqual(["tesorero-sev"])
  })

  it("para un aviso dirigido a la oficina técnica, solo gestores centrales (de cualquier delegación)", async () => {
    const { mod, admin } = await api(
      tablas({
        membresia: [
          { usuario_id: "gestor-1", delegacion_id: SEV.id, rol: "gestor_central" },
          { usuario_id: "gestor-2", delegacion_id: MAD.id, rol: "gestor_central" },
          { usuario_id: "tesorero-sev", delegacion_id: SEV.id, rol: "tesorero" },
        ],
      }),
    )
    const res = await mod.listarAsignablesAviso(admin, "Sevilla", "oficina_tecnica")
    expect(res.map((a) => a.id).sort()).toEqual(["gestor-1", "gestor-2"])
  })

  it("no duplica a alguien con varias membresías que cumplen el filtro", async () => {
    const { mod, admin } = await api(
      tablas({
        membresia: [
          { usuario_id: "gestor-1", delegacion_id: SEV.id, rol: "gestor_central" },
          { usuario_id: "gestor-1", delegacion_id: MAD.id, rol: "gestor_central" },
        ],
      }),
    )
    const res = await mod.listarAsignablesAviso(admin, "Sevilla", "oficina_tecnica")
    expect(res).toHaveLength(1)
  })

  it("sin nadie que cumpla, devuelve una lista vacía en vez de fallar", async () => {
    const { mod, admin } = await api(tablas())
    const res = await mod.listarAsignablesAviso(admin, "Sevilla", "delegacion")
    expect(res).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe("eliminarAviso", () => {
  it("borra el aviso existente", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    await mod.eliminarAviso(admin, "aviso-1")
    expect(admin.tablas.aviso).toHaveLength(0)
  })

  it("uno inexistente da 404 y no toca nada", async () => {
    const { mod, admin } = await api(tablas({ aviso: [aviso()] }))
    await expect(mod.eliminarAviso(admin, "no-existe")).rejects.toMatchObject({ status: 404 })
    expect(admin.tablas.aviso).toHaveLength(1)
  })
})

describe("notificarAviso", () => {
  it("un aviso inexistente da 404 antes de intentar enviar nada", async () => {
    const { mod, admin, notificaciones } = await api()
    await expect(mod.notificarAviso(admin, "no-existe", ACTOR)).rejects.toMatchObject({ status: 404 })
    expect(notificaciones.enviarNotificacionAviso).not.toHaveBeenCalled()
  })

  it("delega en el servicio de notificaciones y firma con quien lo reenvía", async () => {
    const { mod, admin, notificaciones } = await api(tablas({ aviso: [aviso()] }))
    vi.mocked(notificaciones.enviarNotificacionAviso).mockResolvedValue({ destinatarios: ["x@example.com"] })
    const res = await mod.notificarAviso(admin, "aviso-1", "otro-actor")
    expect(res.destinatarios).toEqual(["x@example.com"])
    expect(notificaciones.enviarNotificacionAviso).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ id: "aviso-1" }),
      { marcarNotificadoPor: "otro-actor" },
    )
  })
})
