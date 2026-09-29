import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * La ficha junta tres lecturas (movimiento, factura, ficheros). Las lecturas en
 * sí ya están probadas en sus módulos: aquí se comprueba lo que añade la ficha
 * —la aritmética de los importes, que un fichero replicado en movimiento y
 * factura salga una sola vez, y que las URL firmadas salgan acotadas.
 */

const obtenerMovimiento = vi.fn()
const obtenerFactura = vi.fn()
const urlFirmada = vi.fn(async (_a: unknown, bucket: string, path: string, s: number) => `https://s.test/${bucket}/${path}?t=${s}`)

vi.mock("@/lib/api/movimientos-public", () => ({ obtenerMovimiento }))
vi.mock("@/lib/api/facturas", () => ({ obtenerFactura }))
vi.mock("@/lib/api/archivos", () => ({ urlFirmada }))

function archivo(id: string, path: string, over: Record<string, any> = {}) {
  return {
    id,
    nombre_original: `${id}.pdf`,
    tipo_mime: "application/pdf",
    tamano_bytes: 10,
    es_factura: true,
    descripcion: null,
    bucket: "facturas",
    url: "",
    path_storage: path,
    subido_en: "2026-03-10T10:00:00Z",
    ...over,
  }
}

function movimiento(over: Record<string, any> = {}) {
  return { id: "mov-1", importe: -42.5, factura_id: "fac-1", archivos: [], ...over }
}

function factura(over: Record<string, any> = {}) {
  return {
    id: "fac-1",
    importe: 42.5,
    moneda: "EUR",
    importe_pagado: 42.5,
    importe_pendiente: 0,
    archivos: [],
    ...over,
  }
}

beforeEach(() => {
  obtenerMovimiento.mockReset()
  obtenerFactura.mockReset()
  urlFirmada.mockClear()
})

describe("calcularImportes", () => {
  it("compara el gasto (negativo) con la factura (positiva)", async () => {
    const { calcularImportes } = await import("@/lib/api/ficha-movimiento")
    const i = calcularImportes({ importe: -42.5 }, factura({ importe: 50, importe_pagado: 42.5, importe_pendiente: 7.5 }))
    expect(i).toMatchObject({ movimiento: -42.5, movimiento_abs: 42.5, factura: 50, factura_pendiente: 7.5, diferencia: 7.5 })
  })

  it("sin factura, deja a null todo lo de la factura", async () => {
    const { calcularImportes } = await import("@/lib/api/ficha-movimiento")
    const i = calcularImportes({ importe: -10 }, null)
    expect(i).toMatchObject({ moneda: "EUR", factura: null, factura_pagado: null, factura_pendiente: null, diferencia: null })
  })

  it("factura sin importe: no inventa diferencia", async () => {
    const { calcularImportes } = await import("@/lib/api/ficha-movimiento")
    const i = calcularImportes({ importe: -10 }, factura({ importe: null, importe_pendiente: null }))
    expect(i.diferencia).toBeNull()
  })

  it("no arrastra errores de coma flotante", async () => {
    const { calcularImportes } = await import("@/lib/api/ficha-movimiento")
    expect(calcularImportes({ importe: -0.1 }, factura({ importe: 0.3 })).diferencia).toBe(0.2)
  })
})

describe("obtenerFichaMovimiento", () => {
  it("un fichero replicado en movimiento y factura sale una sola vez", async () => {
    obtenerMovimiento.mockResolvedValue(movimiento({ archivos: [archivo("a", "SEV/x.pdf")] }))
    obtenerFactura.mockResolvedValue(
      factura({ archivos: [archivo("b", "SEV/x.pdf"), archivo("c", "SEV/y.pdf")] }),
    )
    const { obtenerFichaMovimiento } = await import("@/lib/api/ficha-movimiento")
    const ficha = await obtenerFichaMovimiento({} as any, "mov-1")

    expect(ficha.archivos.map((a) => a.path_storage)).toEqual(["SEV/x.pdf", "SEV/y.pdf"])
    expect(ficha.archivos[0].registrado_en).toEqual(["movimiento", "factura"])
    expect(ficha.archivos[1].registrado_en).toEqual(["factura"])
    expect(ficha.archivos[0].url_firmada).toContain("facturas/SEV/x.pdf")
    expect(ficha.factura?.archivos).toEqual([])
  })

  it("movimiento sin factura: no la pide", async () => {
    obtenerMovimiento.mockResolvedValue(movimiento({ factura_id: null, archivos: [archivo("a", "p.pdf")] }))
    const { obtenerFichaMovimiento } = await import("@/lib/api/ficha-movimiento")
    const ficha = await obtenerFichaMovimiento({} as any, "mov-1")
    expect(obtenerFactura).not.toHaveBeenCalled()
    expect(ficha.factura).toBeNull()
    expect(ficha.archivos).toHaveLength(1)
  })

  it("acota la duración de las URL firmadas", async () => {
    obtenerMovimiento.mockResolvedValue(movimiento({ factura_id: null, archivos: [archivo("a", "p.pdf")] }))
    const { obtenerFichaMovimiento } = await import("@/lib/api/ficha-movimiento")
    expect((await obtenerFichaMovimiento({} as any, "m", { segundosUrl: 5 })).archivos[0].caduca_en_segundos).toBe(60)
    expect((await obtenerFichaMovimiento({} as any, "m", { segundosUrl: 999999 })).archivos[0].caduca_en_segundos).toBe(3600)
    expect((await obtenerFichaMovimiento({} as any, "m")).archivos[0].caduca_en_segundos).toBe(900)
  })

  it("movimiento inexistente: 404 con el id en el mensaje", async () => {
    obtenerMovimiento.mockResolvedValue(null)
    const { obtenerFichaMovimiento } = await import("@/lib/api/ficha-movimiento")
    await expect(obtenerFichaMovimiento({} as any, "nope")).rejects.toThrow("nope")
  })
})
