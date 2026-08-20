import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getAppBaseUrl, getAuthCallbackUrl, getDebugAuthConfig } from "@/lib/supabase/redirect"

/**
 * Construcción de la URL a la que Supabase debe devolver tras el login OAuth.
 * Un fallo aquí no se ve en desarrollo (donde `NEXT_PUBLIC_SITE_URL` suele
 * estar bien puesto) y explota en producción con un dominio distinto o sin
 * protocolo — por eso importa cubrir los huecos: sin variable de entorno,
 * con un origin sin `https://`, con barra final, etc.
 */

const ENV_ANTES = { ...process.env }

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
})

afterEach(() => {
  process.env = { ...ENV_ANTES }
})

describe("getAppBaseUrl", () => {
  it("usa NEXT_PUBLIC_SITE_URL cuando está definida", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://banco.movimientoconsolacion.com/"
    expect(getAppBaseUrl()).toBe("https://banco.movimientoconsolacion.com")
  })

  it("añade https:// si la variable de entorno no trae protocolo", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "banco.movimientoconsolacion.com"
    expect(getAppBaseUrl()).toBe("https://banco.movimientoconsolacion.com")
  })

  it("sin variable de entorno, usa el origin que se le pase", () => {
    expect(getAppBaseUrl({ origin: "https://preview-123.vercel.app" })).toBe(
      "https://preview-123.vercel.app",
    )
  })

  it("la variable de entorno manda sobre el origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://banco.movimientoconsolacion.com"
    expect(getAppBaseUrl({ origin: "https://otra-cosa.example" })).toBe(
      "https://banco.movimientoconsolacion.com",
    )
  })

  it("sin nada configurado y sin fallbackToWindow, devuelve una cadena vacía", () => {
    expect(getAppBaseUrl()).toBe("")
  })

  it("un origin vacío no cuenta como configurado", () => {
    expect(getAppBaseUrl({ origin: "" })).toBe("")
  })
})

describe("getAuthCallbackUrl", () => {
  it("añade /auth/callback a la base", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://banco.movimientoconsolacion.com"
    expect(getAuthCallbackUrl()).toBe("https://banco.movimientoconsolacion.com/auth/callback")
  })

  it("sin base conocida, devuelve la ruta relativa", () => {
    expect(getAuthCallbackUrl()).toBe("/auth/callback")
  })
})

describe("getDebugAuthConfig", () => {
  it("resume la configuración para el panel de diagnóstico", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://banco.movimientoconsolacion.com"
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL = "http://localhost:3000/auth/callback"

    const config = getDebugAuthConfig()
    expect(config).toMatchObject({
      siteUrl: "https://banco.movimientoconsolacion.com",
      devRedirectUrl: "http://localhost:3000/auth/callback",
      normalizedBaseUrl: "https://banco.movimientoconsolacion.com",
      oauthCallbackUrl: "https://banco.movimientoconsolacion.com/auth/callback",
      hasProtocol: true,
    })
  })

  it("sin protocolo en la variable de entorno, hasProtocol es false", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "banco.movimientoconsolacion.com"
    expect(getDebugAuthConfig().hasProtocol).toBe(false)
  })
})
