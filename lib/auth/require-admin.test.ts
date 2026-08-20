import { describe, it, expect, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Guarda para las rutas admin-only que usan la service role key. Sin
 * sesión, 401. Con sesión pero sin ser gestor central, 403. Solo con las dos
 * cosas se devuelve el usuario para que la ruta siga.
 */

let usuarioAutenticado: { id: string; email?: string | null } | null = null
let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: (tabla: string) => fakeAdmin.from(tabla),
  }),
}))

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { membresia: [], ...extra }
}

describe("requireAdmin", () => {
  it("sin sesión, 401", async () => {
    usuarioAutenticado = null
    fakeAdmin = crearFakeAdmin(tablas())
    const { requireAdmin } = await import("@/lib/auth/require-admin")
    const resultado: any = await requireAdmin()
    expect(resultado.error).toBeDefined()
    expect(resultado.error.status).toBe(401)
  })

  it("con sesión pero sin membresía de gestor_central, 403", async () => {
    usuarioAutenticado = { id: "user-1" }
    fakeAdmin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "user-1", delegacion_id: "d1", rol: "tesorero" }] }),
    )
    const { requireAdmin } = await import("@/lib/auth/require-admin")
    const resultado: any = await requireAdmin()
    expect(resultado.error.status).toBe(403)
  })

  it("un gestor central pasa, y se devuelve el usuario", async () => {
    usuarioAutenticado = { id: "user-1", email: "gestor@central.example" }
    fakeAdmin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "user-1", delegacion_id: "d1", rol: "gestor_central" }] }),
    )
    const { requireAdmin } = await import("@/lib/auth/require-admin")
    const resultado: any = await requireAdmin()
    expect(resultado.error).toBeUndefined()
    expect(resultado.user).toMatchObject({ id: "user-1" })
  })
})
