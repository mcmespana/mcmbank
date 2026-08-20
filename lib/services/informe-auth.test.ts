import { describe, it, expect, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Guarda de acceso a una delegación para las rutas de informes: sin sesión,
 * 401; sin delegación indicada, 400; sin membresía, 403; y con membresía de
 * solo lectura pidiendo escritura, también 403. Solo tesorero/gestor_central
 * pueden escribir.
 */

let usuarioAutenticado: { id: string } | null = null
let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado } }) },
    from: (tabla: string) => fakeAdmin.from(tabla),
  }),
}))

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { membresia: [], ...extra }
}

describe("requireDelegationAccess", () => {
  it("sin sesión, 401", async () => {
    usuarioAutenticado = null
    fakeAdmin = crearFakeAdmin(tablas())
    const { requireDelegationAccess } = await import("@/lib/services/informe-auth")
    const resultado: any = await requireDelegationAccess("del-1")
    expect(resultado.error.status).toBe(401)
  })

  it("sin delegacion_id, 400", async () => {
    usuarioAutenticado = { id: "user-1" }
    fakeAdmin = crearFakeAdmin(tablas())
    const { requireDelegationAccess } = await import("@/lib/services/informe-auth")
    const resultado: any = await requireDelegationAccess("")
    expect(resultado.error.status).toBe(400)
  })

  it("sin membresía en esa delegación, 403", async () => {
    usuarioAutenticado = { id: "user-1" }
    fakeAdmin = crearFakeAdmin(tablas())
    const { requireDelegationAccess } = await import("@/lib/services/informe-auth")
    const resultado: any = await requireDelegationAccess("del-1")
    expect(resultado.error.status).toBe(403)
  })

  it("miembro de solo lectura puede leer pero no escribir", async () => {
    usuarioAutenticado = { id: "user-1" }
    fakeAdmin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "user-1", delegacion_id: "del-1", rol: "consulta" }] }),
    )
    const { requireDelegationAccess } = await import("@/lib/services/informe-auth")

    const lectura: any = await requireDelegationAccess("del-1")
    expect(lectura.error).toBeUndefined()
    expect(lectura.rol).toBe("consulta")

    const escritura: any = await requireDelegationAccess("del-1", { write: true })
    expect(escritura.error.status).toBe(403)
  })

  it("tesorero y gestor_central sí pueden escribir", async () => {
    usuarioAutenticado = { id: "user-1" }
    fakeAdmin = crearFakeAdmin(
      tablas({ membresia: [{ usuario_id: "user-1", delegacion_id: "del-1", rol: "tesorero" }] }),
    )
    const { requireDelegationAccess } = await import("@/lib/services/informe-auth")
    const resultado: any = await requireDelegationAccess("del-1", { write: true })
    expect(resultado.error).toBeUndefined()
    expect(resultado.user.id).toBe("user-1")
  })
})
