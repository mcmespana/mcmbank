import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

/**
 * URLs firmadas de descarga: se cachean 4 minutos y las peticiones
 * concurrentes al mismo archivo se comparten (una bandeja con veinte
 * facturas no debe pedir veinte firmas de la misma URL). Lo que hay que
 * comprobar es justo eso — caché, dedup en vuelo, expiración e invalidación
 * manual — no la llamada de red en sí.
 */

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function importar() {
  return import("@/lib/utils/signed-file-url")
}

describe("getSignedFileUrl · caché", () => {
  it("pide la firma una vez y la reutiliza en llamadas siguientes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://firmada.test/a" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl } = await importar()

    const a = await getSignedFileUrl("sev/factura.pdf", "facturas")
    const b = await getSignedFileUrl("sev/factura.pdf", "facturas")

    expect(a).toBe("https://firmada.test/a")
    expect(b).toBe("https://firmada.test/a")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("dos rutas o buckets distintos no comparten caché", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://firmada.test/x" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl } = await importar()

    await getSignedFileUrl("a.pdf", "facturas")
    await getSignedFileUrl("a.pdf", "documentos")
    await getSignedFileUrl("b.pdf", "facturas")

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("pasado el TTL de 4 minutos, vuelve a pedir la firma", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://firmada.test/a" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl } = await importar()

    await getSignedFileUrl("a.pdf", "facturas")
    vi.advanceTimersByTime(4 * 60 * 1000 + 1)
    await getSignedFileUrl("a.pdf", "facturas")

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("dos peticiones concurrentes al mismo archivo comparten la misma llamada de red", async () => {
    let resolver: (v: any) => void = () => {}
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl } = await importar()

    const p1 = getSignedFileUrl("a.pdf", "facturas")
    const p2 = getSignedFileUrl("a.pdf", "facturas")
    resolver({ ok: true, json: async () => ({ url: "https://firmada.test/unica" }) })

    const [a, b] = await Promise.all([p1, p2])
    expect(a).toBe("https://firmada.test/unica")
    expect(b).toBe("https://firmada.test/unica")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("si el servidor responde con error, lanza con su mensaje y no lo cachea", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "archivo no encontrado" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://firmada.test/reintento" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl } = await importar()

    await expect(getSignedFileUrl("roto.pdf", "facturas")).rejects.toThrow("archivo no encontrado")
    // El fallo no se cachea: la siguiente llamada vuelve a intentarlo.
    const url = await getSignedFileUrl("roto.pdf", "facturas")
    expect(url).toBe("https://firmada.test/reintento")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("olvidarUrlFirmada", () => {
  it("invalida la caché de ese archivo concreto", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://firmada.test/vieja" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://firmada.test/nueva" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl, olvidarUrlFirmada } = await importar()

    await getSignedFileUrl("a.pdf", "facturas")
    olvidarUrlFirmada("a.pdf", "facturas")
    const url = await getSignedFileUrl("a.pdf", "facturas")

    expect(url).toBe("https://firmada.test/nueva")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("olvidar un archivo no afecta la caché de otro", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://firmada.test/x" }) })
    vi.stubGlobal("fetch", fetchMock)
    const { getSignedFileUrl, olvidarUrlFirmada } = await importar()

    await getSignedFileUrl("a.pdf", "facturas")
    await getSignedFileUrl("b.pdf", "facturas")
    olvidarUrlFirmada("a.pdf", "facturas")
    await getSignedFileUrl("b.pdf", "facturas")

    expect(fetchMock).toHaveBeenCalledTimes(2) // a y b, pero b no se repite
  })
})
