import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

/**
 * Server actions de autenticación: login, la solicitud de acceso por correo
 * (no hay alta directa) y logout. Lo que importa comprobar es la validación
 * antes de tocar red, que un fallo de Supabase o de Resend se traduzca en un
 * mensaje legible en vez de reventar, y que el logout siempre redirija al
 * login tras cerrar sesión.
 */

const signInWithPassword = vi.fn()
const signOut = vi.fn()
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signInWithPassword, signOut } }),
}))

vi.mock("next/navigation", () => ({ redirect }))

const ENV_ANTES = { ...process.env }

function formData(valores: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(valores)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = "re_test_key"
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
})

describe("signIn", () => {
  it("sin email o contraseña, no llega a llamar a Supabase", async () => {
    const { signIn } = await import("@/lib/actions/auth")
    const resultado = await signIn(null, formData({ email: "", password: "" }))
    expect(resultado).toEqual({ error: "Email and password are required" })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it("con credenciales correctas, inicia sesión", async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const { signIn } = await import("@/lib/actions/auth")
    const resultado = await signIn(null, formData({ email: "a@b.com", password: "secreto" }))
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "secreto" })
    expect(resultado).toEqual({ success: true })
  })

  it("si Supabase rechaza las credenciales, devuelve su mensaje", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } })
    const { signIn } = await import("@/lib/actions/auth")
    const resultado = await signIn(null, formData({ email: "a@b.com", password: "mala" }))
    expect(resultado).toEqual({ error: "Invalid login credentials" })
  })

  it("un fallo inesperado no revienta la acción", async () => {
    signInWithPassword.mockRejectedValue(new Error("boom"))
    const { signIn } = await import("@/lib/actions/auth")
    const resultado = await signIn(null, formData({ email: "a@b.com", password: "x" }))
    expect(resultado).toEqual({ error: "An unexpected error occurred. Please try again." })
  })
})

describe("signUp · validación", () => {
  it("sin correo o sin delegación, pide los dos", async () => {
    const espia = vi.fn()
    vi.stubGlobal("fetch", espia)
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "", delegation: "" }))
    expect(resultado.error).toContain("correo")
    expect(espia).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("un correo sin forma de correo se rechaza", async () => {
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "no-es-un-correo", delegation: "Sevilla" }))
    expect(resultado.error).toContain("no tiene pinta")
  })

  it("sin RESEND_API_KEY configurada, avisa sin intentar enviar nada", async () => {
    delete process.env.RESEND_API_KEY
    vi.stubGlobal("fetch", vi.fn())
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "a@b.com", delegation: "Sevilla" }))
    expect(resultado.error).toContain("servicio de correo no está configurado")
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe("signUp · envío del correo", () => {
  it("con datos válidos, envía la petición a Resend con la delegación en el asunto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }))
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "  a@b.com  ", delegation: "Sevilla" }))

    expect(resultado.success).toBeDefined()
    const [url, opts] = (fetch as any).mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    const cuerpo = JSON.parse(opts.body)
    expect(cuerpo.subject).toContain("Sevilla")
    expect(cuerpo.reply_to).toEqual(["a@b.com"])
    vi.unstubAllGlobals()
  })

  it("si Resend responde con error, avisa sin reventar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: async () => "clave inválida" }))
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "a@b.com", delegation: "Sevilla" }))
    expect(resultado.error).toContain("No pudimos enviar")
    vi.unstubAllGlobals()
  })

  it("si la petición lanza (sin red), también avisa sin reventar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const { signUp } = await import("@/lib/actions/auth")
    const resultado = await signUp(null, formData({ email: "a@b.com", delegation: "Sevilla" }))
    expect(resultado.error).toContain("Algo ha fallado")
    vi.unstubAllGlobals()
  })
})

describe("signOut", () => {
  it("cierra la sesión y redirige siempre al login", async () => {
    signOut.mockResolvedValue(undefined)
    const { signOut: signOutAction } = await import("@/lib/actions/auth")
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/auth/login")
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith("/auth/login")
  })
})
