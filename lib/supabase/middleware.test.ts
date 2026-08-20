import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * `updateSession` es lo que corre en cada petición. Lo que importa es que
 * falle cerrado si Supabase no está configurado (mejor un 500 visible que
 * dejar pasar sin autenticar), que las rutas protegidas exijan sesión, que
 * las páginas de auth redirijan a quien ya ha entrado (salvo el callback,
 * que necesita completarse) y que todo lo demás pase sin tocarlo.
 */

let usuarioAutenticado: { id: string } | null = null

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado } }) },
  }),
}))

const ENV_ANTES = { ...process.env }

function req(pathname: string) {
  return new NextRequest(`https://banco.test${pathname}`)
}

beforeEach(() => {
  // `isSupabaseConfigured` se calcula una vez al cargar el módulo: sin
  // resetear, el valor de un test con las variables borradas se quedaría
  // fijo para el resto del fichero.
  vi.resetModules()
  usuarioAutenticado = null
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
})

describe("updateSession · Supabase mal configurado", () => {
  it("una ruta protegida se rechaza con redirect a login (falla cerrado)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/transacciones"))
    expect(res.status).toBe(307)
    const destino = new URL(res.headers.get("location")!)
    expect(destino.pathname).toBe("/auth/login")
    expect(destino.searchParams.get("error")).toBe("config")
  })

  it("una ruta pública deja pasar aunque Supabase no esté configurado", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/auth/login"))
    expect(res.headers.get("location")).toBeNull()
  })
})

describe("updateSession · rutas protegidas", () => {
  it("sin sesión, una ruta protegida redirige a /auth/login", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/transacciones"))
    const destino = new URL(res.headers.get("location")!)
    expect(destino.pathname).toBe("/auth/login")
  })

  it("el dashboard ('/') también exige sesión", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/"))
    expect(res.headers.get("location")).toContain("/auth/login")
  })

  it("con sesión, una ruta protegida no redirige", async () => {
    usuarioAutenticado = { id: "user-1" }
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/transacciones"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("una ruta que no está en la lista no exige sesión", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/algo-que-no-existe"))
    expect(res.headers.get("location")).toBeNull()
  })
})

describe("updateSession · páginas de autenticación", () => {
  it("con sesión ya iniciada, /auth/login redirige al dashboard", async () => {
    usuarioAutenticado = { id: "user-1" }
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/auth/login"))
    const destino = new URL(res.headers.get("location")!)
    expect(destino.pathname).toBe("/")
  })

  it("el callback de OAuth no se redirige aunque ya haya sesión (necesita completarse)", async () => {
    usuarioAutenticado = { id: "user-1" }
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/auth/callback"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("sin sesión, /auth/login no redirige a ningún sitio", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(req("/auth/login"))
    expect(res.headers.get("location")).toBeNull()
  })
})
