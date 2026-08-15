import { describe, it, expect, vi, afterEach } from "vitest"
import {
  ApiError,
  badRequest,
  conflict,
  errorResponse,
  misconfigured,
  notFound,
  toErrorPayload,
  unwrap,
  wrapSupabaseError,
} from "@/lib/api/errors"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("constructores de ApiError", () => {
  it("cada atajo lleva su código HTTP", () => {
    expect(badRequest("mal").status).toBe(400)
    expect(notFound("no está").status).toBe(404)
    expect(conflict("choca").status).toBe(409)
    expect(misconfigured("falta env").status).toBe(500)
  })

  it("es un Error de verdad, con nombre propio", () => {
    const err = badRequest("mal")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("ApiError")
    expect(err.message).toBe("mal")
  })

  it("guarda los detalles que ayudan a corregir la llamada", () => {
    expect(badRequest("mal", { valores_validos: ["a", "b"] }).detalles).toEqual({
      valores_validos: ["a", "b"],
    })
  })
})

describe("wrapSupabaseError", () => {
  it("un Error se devuelve tal cual", () => {
    const original = new Error("boom")
    expect(wrapSupabaseError(original)).toBe(original)
  })

  it("convierte el objeto plano de PostgREST en un Error legible", () => {
    const err = wrapSupabaseError({
      message: "duplicate key",
      details: "Key (id)=(1) already exists.",
      hint: "Usa otro id",
    })
    expect(err.message).toBe("duplicate key · Key (id)=(1) already exists. · Usa otro id")
  })

  it("se queda con la primera línea de cada parte (las trazas de red son enormes)", () => {
    const err = wrapSupabaseError({
      message: "fetch failed",
      details: "TypeError: fetch failed\n    at node:internal/deps\n    at async run",
    })
    expect(err.message).toBe("fetch failed · TypeError: fetch failed")
  })

  it("nunca acaba en '[object Object]'", () => {
    expect(wrapSupabaseError({ codigo: 500 }).message).toBe("Error desconocido de Supabase.")
    expect(wrapSupabaseError(null).message).toBe("Error desconocido de Supabase.")
    expect(wrapSupabaseError("texto suelto").message).toBe("Error desconocido de Supabase.")
  })
})

describe("unwrap", () => {
  it("devuelve los datos cuando no hay error", () => {
    expect(unwrap({ data: [{ id: "1" }], error: null })).toEqual([{ id: "1" }])
  })

  it("lanza cuando Supabase devuelve error", () => {
    expect(() => unwrap({ data: null, error: { message: "sin permiso" } })).toThrow("sin permiso")
  })

  it("un data nulo sin error es válido (maybeSingle sin resultado)", () => {
    expect(unwrap({ data: null, error: null })).toBeNull()
  })
})

describe("toErrorPayload", () => {
  it("un ApiError sale tal cual, con su estado", () => {
    expect(toErrorPayload(notFound("No existe la delegación."))).toEqual({
      status: 404,
      body: { ok: false, error: "No existe la delegación." },
    })
  })

  it("incluye los detalles solo si los hay", () => {
    const { body } = toErrorPayload(badRequest("mal", { candidatos: ["Sevilla"] }))
    expect(body).toEqual({ ok: false, error: "mal", detalles: { candidatos: ["Sevilla"] } })
    expect(toErrorPayload(badRequest("mal")).body).not.toHaveProperty("detalles")
  })

  it("un error inesperado se registra entero y se publica recortado", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {})
    const traza = new Error("Algo ha explotado\n    at /var/task/lib/api/facturas.ts:120:7")

    const { status, body } = toErrorPayload(traza)

    expect(status).toBe(500)
    expect(body.error).toBe("Algo ha explotado")
    expect(body.error).not.toContain("/var/task")
    expect(consola).toHaveBeenCalled()
  })

  it("recorta los mensajes larguísimos a 300 caracteres", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { body } = toErrorPayload(new Error("x".repeat(500)))
    expect(body.error).toHaveLength(300)
    expect(body.error.endsWith("…")).toBe(true)
  })

  it("lo que se lanza sin ser Error también acaba en un mensaje", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(toErrorPayload("fallo suelto").body.error).toBe("fallo suelto")
    expect(toErrorPayload(undefined).body.error).toBe("undefined")
  })

  it("un mensaje vacío no deja al cliente sin explicación", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(toErrorPayload(new Error("")).body.error).toBe("Error interno.")
  })
})

describe("errorResponse", () => {
  it("devuelve una respuesta JSON con el estado del error", async () => {
    const res = errorResponse(conflict("Ya existe."))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Ya existe." })
  })

  it("un error interno sale como 500 sin filtrar la traza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = errorResponse(new Error("secreto\n at /var/task/app.js"))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ ok: false, error: "secreto" })
  })
})
