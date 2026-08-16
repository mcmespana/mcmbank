import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin } from "@/lib/test-utils/fake-admin"

/**
 * Quién firma una escritura hecha desde la API o el MCP. La regla que hay que
 * defender es "nunca se elige un usuario cualquiera": una nota firmada por la
 * persona equivocada es peor que una nota que no se guarda.
 *
 * El módulo cachea la lista de usuarios cinco minutos, así que se recarga en
 * cada test.
 */

const USUARIOS = [
  { id: "11111111-1111-1111-1111-111111111111", email: "David@movimientoconsolacion.com" },
  { id: "22222222-2222-2222-2222-222222222222", email: "ana@movimientoconsolacion.com" },
]

const PERFILES = [
  { usuario_id: USUARIOS[0].id, nombre_completo: "  David Fernández  " },
  { usuario_id: USUARIOS[1].id, nombre_completo: "   " },
]

const ENV = ["MCM_API_USER_ID", "MCM_API_USER_EMAIL"] as const
const original: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.resetModules()
  for (const k of ENV) {
    original[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV) {
    if (original[k] === undefined) delete process.env[k]
    else process.env[k] = original[k]
  }
})

async function conActor(hint?: any, opciones = {}) {
  const { resolveActor } = await import("@/lib/api/actor")
  const admin = crearFakeAdmin({ perfil: PERFILES }, { usuarios: USUARIOS, ...opciones })
  return resolveActor(admin as any, hint)
}

describe("esUuid", () => {
  it("acepta un UUID y rechaza lo que no lo es", async () => {
    const { esUuid } = await import("@/lib/api/actor")
    expect(esUuid("11111111-1111-1111-1111-111111111111")).toBe(true)
    expect(esUuid("11111111-1111-1111-1111-111111111111".toUpperCase())).toBe(true)
    expect(esUuid("ana@movimientoconsolacion.com")).toBe(false)
    expect(esUuid("1111")).toBe(false)
    expect(esUuid(null)).toBe(false)
    expect(esUuid(42)).toBe(false)
  })
})

describe("resolveActor · a partir de la llamada", () => {
  it("resuelve por email, sin distinguir mayúsculas", async () => {
    const actor = await conActor({ usuario_email: "DAVID@movimientoconsolacion.com" })
    expect(actor.id).toBe(USUARIOS[0].id)
    expect(actor.email).toBe("David@movimientoconsolacion.com")
  })

  it("resuelve por id de usuario", async () => {
    expect((await conActor({ usuario_id: USUARIOS[1].id })).email).toBe(
      "ana@movimientoconsolacion.com",
    )
  })

  it("el id manda sobre el email cuando llegan los dos", async () => {
    const actor = await conActor({
      usuario_id: USUARIOS[0].id,
      usuario_email: "ana@movimientoconsolacion.com",
    })
    expect(actor.id).toBe(USUARIOS[0].id)
  })

  it("completa el nombre desde el perfil, recortado", async () => {
    expect((await conActor({ usuario_id: USUARIOS[0].id })).nombre).toBe("David Fernández")
  })

  it("un perfil sin nombre útil deja el nombre a null en vez de espacios", async () => {
    expect((await conActor({ usuario_id: USUARIOS[1].id })).nombre).toBeNull()
  })

  it("un id que no es UUID se rechaza con 400 antes de consultar nada", async () => {
    await expect(conActor({ usuario_id: "pepito" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("pepito"),
    })
  })

  it("un usuario inexistente da 404 y dice dónde mirar", async () => {
    await expect(conActor({ usuario_email: "nadie@ejemplo.com" })).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining("MCM_API_USER_EMAIL"),
    })
    await expect(
      conActor({ usuario_id: "99999999-9999-9999-9999-999999999999" }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe("resolveActor · autor por defecto del servidor", () => {
  it("usa MCM_API_USER_EMAIL cuando la llamada no dice nada", async () => {
    process.env.MCM_API_USER_EMAIL = "ana@movimientoconsolacion.com"
    expect((await conActor()).id).toBe(USUARIOS[1].id)
  })

  it("usa MCM_API_USER_ID con preferencia sobre el email", async () => {
    process.env.MCM_API_USER_ID = USUARIOS[0].id
    process.env.MCM_API_USER_EMAIL = "ana@movimientoconsolacion.com"
    expect((await conActor()).id).toBe(USUARIOS[0].id)
  })

  it("lo que llega en la llamada gana a la variable de entorno", async () => {
    process.env.MCM_API_USER_EMAIL = "ana@movimientoconsolacion.com"
    expect((await conActor({ usuario_email: "david@movimientoconsolacion.com" })).id).toBe(
      USUARIOS[0].id,
    )
  })

  it("sin autor por ningún lado falla explicando qué configurar", async () => {
    await expect(conActor()).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("MCM_API_USER_ID"),
    })
  })

  it("una pista en blanco no cuenta como autor", async () => {
    await expect(conActor({ usuario_email: "   ", usuario_id: null })).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe("resolveActor · fallos de infraestructura", () => {
  it("si no se puede listar usuarios, lo dice en vez de firmar con otro", async () => {
    await expect(
      conActor({ usuario_email: "david@movimientoconsolacion.com" }, {
        errorUsuarios: { message: "service_role inválida" },
      }),
    ).rejects.toThrow("service_role inválida")
  })
})

describe("nombreActor", () => {
  it("prefiere el nombre, luego el email y por último el id", async () => {
    const { nombreActor } = await import("@/lib/api/actor")
    expect(nombreActor({ id: "u1", nombre: "David", email: "d@x.com" })).toBe("David")
    expect(nombreActor({ id: "u1", nombre: null, email: "d@x.com" })).toBe("d@x.com")
    expect(nombreActor({ id: "u1", nombre: null, email: null })).toBe("u1")
  })
})
