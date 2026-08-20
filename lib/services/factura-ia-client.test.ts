import { describe, it, expect, afterEach, vi } from "vitest"
import { leerFacturaConIa, aceptarCategoriaIa } from "@/lib/services/factura-ia-client"

/**
 * Wrapper de fetch hacia `/api/facturas/ia`. Lo único que puede salir mal
 * aquí es el contrato de errores: que un fallo del servidor se lea con su
 * mensaje en vez de un "Error 500" genérico, y que el cuerpo enviado sea el
 * que espera la ruta.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("leerFacturaConIa", () => {
  it("pide extraer y devuelve datos_ia", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ datos_ia: { estado: "listo" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const datos = await leerFacturaConIa("fac-1")
    expect(datos).toEqual({ estado: "listo" })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/facturas/ia")
    expect(JSON.parse(opts.body)).toEqual({ facturaId: "fac-1", accion: "extraer", forzar: false })
  })

  it("propaga forzar:true en el cuerpo de la petición", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    await leerFacturaConIa("fac-1", { forzar: true })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).forzar).toBe(true)
  })

  it("sin datos_ia en la respuesta, devuelve null en vez de undefined", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await leerFacturaConIa("fac-1")).toBeNull()
  })

  it("si el servidor falla, lanza con su mensaje de error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "no existe la factura" }) }),
    )
    await expect(leerFacturaConIa("fac-x")).rejects.toThrow("no existe la factura")
  })

  it("si el servidor falla sin cuerpo JSON, usa el código de estado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("no es json") } }),
    )
    await expect(leerFacturaConIa("fac-1")).rejects.toThrow("Error 500")
  })
})

describe("aceptarCategoriaIa", () => {
  it("manda la acción y la categoría elegida", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    await aceptarCategoriaIa("fac-1", "cat-9")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      facturaId: "fac-1",
      accion: "aceptar_categoria",
      categoria_id: "cat-9",
    })
  })

  it("sin categoría indicada, manda null (usa la sugerida por la IA)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    await aceptarCategoriaIa("fac-1")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).categoria_id).toBeNull()
  })

  it("si falla, lanza con el mensaje del servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "categoría inválida" }) }),
    )
    await expect(aceptarCategoriaIa("fac-1", "cat-x")).rejects.toThrow("categoría inválida")
  })
})
