import { describe, it, expect, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Quién puede autorizar el conector OAuth del MCP: solo gestores centrales,
 * porque el servidor MCP bypasea RLS y ve las 18 delegaciones. Dárselo a
 * cualquier usuario autenticado abriría las cuentas de las demás delegaciones
 * al tesorero equivocado.
 */

let usuarioAutenticado: { id: string; email?: string | null } | null = null

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado } }) },
  }),
}))

let fakeAdmin: ReturnType<typeof crearFakeAdmin>
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeAdmin,
}))

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { membresia: [], perfil: [], ...extra }
}

describe("usuarioActual", () => {
  it("sin sesión, devuelve null", async () => {
    usuarioAutenticado = null
    fakeAdmin = crearFakeAdmin(tablas())
    const { usuarioActual } = await import("@/lib/oauth/sesion")
    expect(await usuarioActual()).toBeNull()
  })

  it("un gestor central se marca como tal, con su nombre de perfil", async () => {
    usuarioAutenticado = { id: "user-1", email: "gestor@central.example" }
    fakeAdmin = crearFakeAdmin(
      tablas({
        membresia: [{ usuario_id: "user-1", delegacion_id: "d1", rol: "gestor_central" }],
        perfil: [{ usuario_id: "user-1", nombre_completo: "Ana Gestora" }],
      }),
    )
    const { usuarioActual } = await import("@/lib/oauth/sesion")
    const resultado = await usuarioActual()
    expect(resultado).toMatchObject({
      id: "user-1",
      email: "gestor@central.example",
      nombre: "Ana Gestora",
      esGestorCentral: true,
    })
  })

  it("un tesorero (sin membresía de gestor_central) no puede autorizar", async () => {
    usuarioAutenticado = { id: "user-2", email: "tesorero@sevilla.example" }
    fakeAdmin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "user-2", delegacion_id: "d1", rol: "tesorero" }] }),
    )
    const { usuarioActual } = await import("@/lib/oauth/sesion")
    const resultado = await usuarioActual()
    expect(resultado?.esGestorCentral).toBe(false)
  })

  it("sin perfil, el nombre es null en vez de romper", async () => {
    usuarioAutenticado = { id: "user-3", email: "sin-perfil@example.com" }
    fakeAdmin = crearFakeAdmin(tablas())
    const { usuarioActual } = await import("@/lib/oauth/sesion")
    const resultado = await usuarioActual()
    expect(resultado?.nombre).toBeNull()
  })
})
