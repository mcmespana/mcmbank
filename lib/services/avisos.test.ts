import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Espejo cliente de `lib/api/avisos.ts`, usado por `use-avisos.ts`. La
 * validación (contenido vacío, límites) ya se prueba del lado servidor; lo
 * que es exclusivo de aquí es cómo se resuelve un aviso para pintarlo:
 * `esMio`, `esParaMi`, `esResponsableMio` y `noLeido` — cuatro banderas que
 * dependen de quién mira la pantalla, no solo de la fila en la base de datos.
 */

let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (tabla: string) => fakeAdmin.from(tabla),
  },
}))

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { aviso: [], perfil: [], membresia: [], ...extra }
}

const YO = "yo-1"
const OTRO = "otro-2"

function avisoRow(over: Record<string, any> = {}) {
  return {
    id: "aviso-1",
    delegacion_id: "del-1",
    tipo: "nota",
    contenido: "hola",
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
    creado_por: OTRO,
    creado_en: "2026-03-01T00:00:00Z",
    actualizado_en: "2026-03-01T00:00:00Z",
    lecturas: [],
    ...over,
  }
}

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
  vi.unstubAllGlobals()
})

async function servicio(t: Tablas = tablas()) {
  fakeAdmin = crearFakeAdmin(t)
  const { AvisosService } = await import("@/lib/services/avisos")
  return AvisosService
}

describe("listar · banderas derivadas para la UI", () => {
  it("un aviso creado por mí es 'mío' y nunca 'no leído'", async () => {
    const AvisosService = await servicio(tablas({ aviso: [avisoRow({ creado_por: YO })] }))
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.esMio).toBe(true)
    expect(aviso.noLeido).toBe(false)
  })

  it("un aviso de otra persona que no he leído sale como 'no leído'", async () => {
    const AvisosService = await servicio(tablas({ aviso: [avisoRow({ creado_por: OTRO })] }))
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.esMio).toBe(false)
    expect(aviso.noLeido).toBe(true)
  })

  it("si ya lo he leído, deja de estar 'no leído'", async () => {
    const AvisosService = await servicio(
      tablas({ aviso: [avisoRow({ creado_por: OTRO, lecturas: [{ usuario_id: YO }] })] }),
    )
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.noLeido).toBe(false)
  })

  it("esParaMi depende del lado del usuario, no de quién lo escribió", async () => {
    const AvisosService = await servicio(
      tablas({ aviso: [avisoRow({ destinatario: "oficina_tecnica" })] }),
    )
    const paraDelegacion = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    const paraOficina = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "oficina_tecnica" })
    expect(paraDelegacion[0].esParaMi).toBe(false)
    expect(paraOficina[0].esParaMi).toBe(true)
  })

  it("esResponsableMio solo si la tarea me la asignaron a mí", async () => {
    const AvisosService = await servicio(
      tablas({ aviso: [avisoRow({ tipo: "tarea", responsable_id: YO })] }),
    )
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.esResponsableMio).toBe(true)
  })

  it("las lecturas no cuentan al propio autor", async () => {
    const AvisosService = await servicio(
      tablas({
        aviso: [avisoRow({ creado_por: OTRO, lecturas: [{ usuario_id: OTRO }, { usuario_id: YO }] })],
      }),
    )
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.lecturas).toBe(1)
  })

  it("resuelve el nombre del autor desde perfil", async () => {
    const AvisosService = await servicio(
      tablas({
        aviso: [avisoRow({ creado_por: OTRO })],
        perfil: [{ usuario_id: OTRO, nombre_completo: "Ana Tesorera" }],
      }),
    )
    const [aviso] = await AvisosService.listar("del-1", { usuarioId: YO, miLado: "delegacion" })
    expect(aviso.autorNombre).toBe("Ana Tesorera")
  })
})

describe("crear", () => {
  it("rechaza el contenido vacío sin llegar a insertar", async () => {
    const AvisosService = await servicio()
    await expect(
      AvisosService.crear("del-1", YO, { tipo: "nota", contenido: "   ", destinatario: "delegacion" }),
    ).rejects.toThrow("no puede estar vacío")
  })

  it("una nota no guarda campos de tarea aunque se manden", async () => {
    const AvisosService = await servicio()
    await AvisosService.crear("del-1", YO, {
      tipo: "nota",
      contenido: "hola",
      destinatario: "delegacion",
      responsable_id: "user-x",
      urgente: true,
    } as any)
    expect(fakeAdmin.tablas.aviso[0].responsable_id).toBeNull()
    expect(fakeAdmin.tablas.aviso[0].urgente).toBe(false)
  })
})

describe("cambiarEstado", () => {
  it("pasar a 'hecha' registra quién la completó", async () => {
    const AvisosService = await servicio(tablas({ aviso: [avisoRow()] }))
    await AvisosService.cambiarEstado("aviso-1", "hecha", YO)
    expect(fakeAdmin.tablas.aviso[0].completado_por).toBe(YO)
  })
})

describe("actualizarCambios", () => {
  it("sin ningún campo reconocido, no escribe nada", async () => {
    const AvisosService = await servicio(tablas({ aviso: [avisoRow()] }))
    await AvisosService.actualizarCambios("aviso-1", {})
    expect(fakeAdmin.escrituras).toHaveLength(0)
  })

  it("aplica solo los campos presentes", async () => {
    const AvisosService = await servicio(tablas({ aviso: [avisoRow()] }))
    await AvisosService.actualizarCambios("aviso-1", { urgente: true })
    expect(fakeAdmin.tablas.aviso[0].urgente).toBe(true)
    expect(fakeAdmin.tablas.aviso[0].responsable_id).toBeNull()
  })
})

describe("listarAsignables", () => {
  it("para la delegación, solo sus tesoreros; para la oficina, solo gestores centrales", async () => {
    const AvisosService = await servicio(
      tablas({
        membresia: [
          { usuario_id: "tesorero-1", delegacion_id: "del-1", rol: "tesorero" },
          { usuario_id: "gestor-1", delegacion_id: "del-1", rol: "gestor_central" },
        ],
        perfil: [
          { usuario_id: "tesorero-1", nombre_completo: "Tesorero Uno" },
          { usuario_id: "gestor-1", nombre_completo: "Gestor Uno" },
        ],
      }),
    )
    const paraDelegacion = await AvisosService.listarAsignables("del-1", "delegacion")
    expect(paraDelegacion.map((a) => a.id)).toEqual(["tesorero-1"])

    const paraOficina = await AvisosService.listarAsignables("del-1", "oficina_tecnica")
    expect(paraOficina.map((a) => a.id)).toEqual(["gestor-1"])
  })

  it("descarta a quien no tiene nombre de perfil", async () => {
    const AvisosService = await servicio(
      tablas({
        membresia: [{ usuario_id: "sin-perfil", delegacion_id: "del-1", rol: "tesorero" }],
        perfil: [],
      }),
    )
    expect(await AvisosService.listarAsignables("del-1", "delegacion")).toEqual([])
  })
})

describe("marcarLeidos", () => {
  it("una lista vacía no escribe nada", async () => {
    const AvisosService = await servicio()
    await AvisosService.marcarLeidos([], YO)
    expect(fakeAdmin.escrituras).toHaveLength(0)
  })

  it("marca cada aviso como leído por el usuario actual", async () => {
    const AvisosService = await servicio()
    await AvisosService.marcarLeidos(["a1", "a2"], YO)
    expect(fakeAdmin.tablas.aviso_lectura).toHaveLength(2)
    expect(fakeAdmin.tablas.aviso_lectura.every((l: any) => l.usuario_id === YO)).toBe(true)
  })
})

describe("notificar", () => {
  it("con éxito, devuelve los destinatarios que informó la API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ destinatarios: ["a@b.com"] }) }),
    )
    const AvisosService = await servicio()
    const res = await AvisosService.notificar("aviso-1")
    expect(res.destinatarios).toEqual(["a@b.com"])
  })

  it("si la API falla, propaga su mensaje de error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "no hay tesoreros" }) }),
    )
    const AvisosService = await servicio()
    await expect(AvisosService.notificar("aviso-1")).rejects.toThrow("no hay tesoreros")
  })
})
