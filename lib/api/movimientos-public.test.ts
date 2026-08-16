import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Búsqueda de movimientos: es lo que responde "cuánto llevamos gastado en X".
 * Los filtros por defecto (ignorados fuera, cuentas cerradas fuera) y el
 * resumen sobre el conjunto completo —no sobre la página— son la parte que más
 * duele si se rompe, porque el resultado sigue pareciendo correcto.
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }

const CUENTA = { id: "cta-sev", delegacion_id: SEV.id, nombre: "Corriente", tipo: "banco", banco_nombre: "BBVA", iban: "ES91", activa: true }
const CUENTA_MAD = { id: "cta-mad", delegacion_id: MAD.id, nombre: "Corriente MAD", activa: true }
const CUENTA_CERRADA = { id: "cta-off", delegacion_id: SEV.id, nombre: "Antigua", activa: false }

const CATEGORIA = { id: "cat-1", nombre: "Alimentación", tipo: "gasto", emoji: "🍽", color: "#f00", es_global: true, delegacion_id: null, orden: 1, esta_activa: true }
const CONTACTO = { id: "con-1", nombre: "Mercadona", tipo: "proveedor", es_global: true, delegacion_id: null, archivado: false }

let n = 0
function movimiento(over: Record<string, any> = {}) {
  n += 1
  return {
    id: `mov-${String(n).padStart(4, "0")}`,
    delegacion_id: SEV.id,
    cuenta_id: CUENTA.id,
    categoria_id: CATEGORIA.id,
    contacto_id: null,
    factura_id: null,
    concepto: "COMPRA MERCADONA",
    descripcion: null,
    contraparte: null,
    notas: null,
    importe: -20,
    fecha: "2026-03-10",
    ignorado: false,
    factura_pendiente: false,
    creado_en: "2026-03-10T10:00:00Z",
    ...over,
  }
}

function tablas(movimientos: Record<string, any>[] = [], extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    cuenta: [CUENTA, CUENTA_MAD, CUENTA_CERRADA],
    categoria: [CATEGORIA],
    contacto: [CONTACTO],
    movimiento: movimientos,
    movimiento_archivo: [],
    ...extra,
  }
}

beforeEach(() => {
  n = 0
  vi.resetModules()
})

async function buscar(params: Record<string, any> = {}, t: Tablas = tablas()) {
  const mod = await import("@/lib/api/movimientos-public")
  const admin = crearFakeAdmin(t) as any
  const resultado = await mod.buscarMovimientos(admin, { incluirArchivos: false, ...params })
  return { resultado, admin, mod }
}

describe("serializeMovimiento", () => {
  it("deduce el tipo a partir del signo", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    expect(mod.serializeMovimiento(movimiento({ importe: -20 }), []).tipo).toBe("gasto")
    expect(mod.serializeMovimiento(movimiento({ importe: 20 }), []).tipo).toBe("ingreso")
    // Un importe de cero no es un gasto.
    expect(mod.serializeMovimiento(movimiento({ importe: 0 }), []).tipo).toBe("ingreso")
  })

  it("convierte el importe a número aunque llegue como texto", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const salida = mod.serializeMovimiento(movimiento({ importe: "-12.30" }), [])
    expect(salida.importe).toBe(-12.3)
    expect(salida.tipo).toBe("gasto")
  })

  it("las relaciones ausentes salen como null, no undefined", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const salida = mod.serializeMovimiento(movimiento(), [])
    expect(salida.cuenta).toBeNull()
    expect(salida.categoria).toBeNull()
    expect(salida.contacto).toBeNull()
    expect(salida.delegacion).toBeNull()
  })

  it("normaliza los booleanos que llegan nulos de la base de datos", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const salida = mod.serializeMovimiento(movimiento({ ignorado: null, factura_pendiente: null }), [])
    expect(salida.ignorado).toBe(false)
    expect(salida.factura_pendiente).toBe(false)
  })
})

describe("serializeArchivo", () => {
  it("expone el tamaño sin ñ, venga de la tabla que venga", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    expect(mod.serializeArchivo({ id: "a", ["tamaño_bytes"]: 120 }).tamano_bytes).toBe(120)
    expect(mod.serializeArchivo({ id: "a", tamano_bytes: 340 }).tamano_bytes).toBe(340)
    expect(mod.serializeArchivo({ id: "a" }).tamano_bytes).toBe(0)
  })

  it("añade la URL de descarga solo si se conoce la base", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    expect(mod.serializeArchivo({ id: "a1" })).not.toHaveProperty("url_descarga")
    expect(
      mod.serializeArchivo({ id: "a1" }, { baseUrl: "https://mcm.test" }).url_descarga,
    ).toBe("https://mcm.test/api/v1/archivos/a1/descargar")
  })
})

describe("buscarMovimientos · filtros por defecto", () => {
  it("los ignorados quedan fuera salvo que se pidan", async () => {
    const t = tablas([movimiento(), movimiento({ importe: -500, ignorado: true })])
    expect((await buscar({}, t)).resultado.resumen.gastos).toBe(-20)

    vi.resetModules()
    const t2 = tablas([movimiento(), movimiento({ importe: -500, ignorado: true })])
    expect((await buscar({ incluirIgnorados: true }, t2)).resultado.resumen.gastos).toBe(-520)
  })

  it("los de cuentas desactivadas quedan fuera salvo que se pidan", async () => {
    const t = tablas([movimiento(), movimiento({ importe: -500, cuenta_id: CUENTA_CERRADA.id })])
    expect((await buscar({}, t)).resultado.total).toBe(1)

    vi.resetModules()
    const t2 = tablas([movimiento(), movimiento({ importe: -500, cuenta_id: CUENTA_CERRADA.id })])
    expect((await buscar({ incluirCuentasInactivas: true }, t2)).resultado.total).toBe(2)
  })
})

describe("buscarMovimientos · filtros", () => {
  const conjunto = () =>
    tablas([
      movimiento({ importe: -20, fecha: "2026-01-15", concepto: "COMPRA MERCADONA" }),
      movimiento({ importe: 300, fecha: "2026-02-20", concepto: "DONATIVO ANUAL", categoria_id: null }),
      movimiento({ importe: -150, fecha: "2026-03-25", concepto: "AMAZON EU", contacto_id: CONTACTO.id }),
      movimiento({ importe: -80, fecha: "2026-04-05", concepto: "GASOLINERA", factura_id: "fac-1" }),
    ])

  it("por tipo", async () => {
    expect((await buscar({ tipo: "ingreso" }, conjunto())).resultado.total).toBe(1)
    vi.resetModules()
    expect((await buscar({ tipo: "gasto" }, conjunto())).resultado.total).toBe(3)
  })

  it("por rango de fechas, incluyendo los extremos", async () => {
    const { resultado } = await buscar(
      { fechaDesde: "2026-02-20", fechaHasta: "2026-03-25" },
      conjunto(),
    )
    expect(resultado.total).toBe(2)
  })

  it("un rango de fechas al revés se rechaza en vez de devolver cero", async () => {
    await expect(
      buscar({ fechaDesde: "2026-05-01", fechaHasta: "2026-01-01" }, conjunto()),
    ).rejects.toThrow("al revés")
  })

  it("por importe en valor absoluto: 150 encuentra el gasto de -150", async () => {
    const { resultado } = await buscar({ importeMin: 100, importeMax: 200 }, conjunto())
    expect(resultado.total).toBe(1)
    expect(resultado.movimientos[0].importe).toBe(-150)
  })

  it("por texto, palabra a palabra y sin distinguir mayúsculas", async () => {
    expect((await buscar({ texto: "mercadona" }, conjunto())).resultado.total).toBe(1)
    vi.resetModules()
    // Todas las palabras deben aparecer: "amazon donativo" no casa con ninguno.
    expect((await buscar({ texto: "amazon donativo" }, conjunto())).resultado.total).toBe(0)
  })

  it("por categoría y por 'sin categoría'", async () => {
    expect((await buscar({ categoriaIds: [CATEGORIA.id] }, conjunto())).resultado.total).toBe(3)
    vi.resetModules()
    expect((await buscar({ sinCategoria: true }, conjunto())).resultado.total).toBe(1)
  })

  it("por contacto", async () => {
    const { resultado } = await buscar({ contactoIds: [CONTACTO.id] }, conjunto())
    expect(resultado.movimientos.map((m) => m.concepto)).toEqual(["AMAZON EU"])
  })

  it("con y sin factura vinculada", async () => {
    expect((await buscar({ conFactura: true }, conjunto())).resultado.total).toBe(1)
    vi.resetModules()
    expect((await buscar({ conFactura: false }, conjunto())).resultado.total).toBe(3)
  })

  it("por delegación, sin dejar pasar las demás", async () => {
    const t = tablas([
      movimiento(),
      movimiento({ delegacion_id: MAD.id, cuenta_id: CUENTA_MAD.id, importe: -999 }),
    ])
    const { resultado } = await buscar({ delegaciones: [SEV] }, t)
    expect(resultado.total).toBe(1)
    expect(resultado.resumen.gastos).toBe(-20)
  })
})

describe("buscarMovimientos · orden y paginación", () => {
  const conjunto = () =>
    tablas([
      movimiento({ fecha: "2026-01-01", importe: -10 }),
      movimiento({ fecha: "2026-02-01", importe: -30 }),
      movimiento({ fecha: "2026-03-01", importe: -20 }),
    ])

  it("por defecto, de la fecha más reciente a la más antigua", async () => {
    const { resultado } = await buscar({}, conjunto())
    expect(resultado.movimientos.map((m) => m.fecha)).toEqual([
      "2026-03-01",
      "2026-02-01",
      "2026-01-01",
    ])
  })

  it("admite el orden inverso y por importe", async () => {
    expect(
      (await buscar({ orden: "fecha_asc" }, conjunto())).resultado.movimientos[0].fecha,
    ).toBe("2026-01-01")
    vi.resetModules()
    expect(
      (await buscar({ orden: "importe_asc" }, conjunto())).resultado.movimientos[0].importe,
    ).toBe(-30)
    vi.resetModules()
    expect(
      (await buscar({ orden: "importe_desc" }, conjunto())).resultado.movimientos[0].importe,
    ).toBe(-10)
  })

  it("el límite se acota entre 1 y 200", async () => {
    expect((await buscar({ limite: 0 }, conjunto())).resultado.limite).toBe(1)
    vi.resetModules()
    expect((await buscar({ limite: 5000 }, conjunto())).resultado.limite).toBe(200)
    vi.resetModules()
    expect((await buscar({ limite: -3 }, conjunto())).resultado.limite).toBe(1)
  })

  it("hay_mas avisa de que quedan páginas", async () => {
    const primera = (await buscar({ limite: 2 }, conjunto())).resultado
    expect(primera.total).toBe(3)
    expect(primera.movimientos).toHaveLength(2)
    expect(primera.hay_mas).toBe(true)

    vi.resetModules()
    const segunda = (await buscar({ limite: 2, offset: 2 }, conjunto())).resultado
    expect(segunda.movimientos).toHaveLength(1)
    expect(segunda.hay_mas).toBe(false)
  })

  it("un offset negativo se trata como cero", async () => {
    expect((await buscar({ offset: -10 }, conjunto())).resultado.offset).toBe(0)
  })
})

describe("buscarMovimientos · resumen del conjunto entero", () => {
  it("resume TODO lo filtrado, no solo la página que se devuelve", async () => {
    const muchos = Array.from({ length: 30 }, () => movimiento({ importe: -10 }))
    const { resultado } = await buscar({ limite: 5 }, tablas(muchos))

    expect(resultado.movimientos).toHaveLength(5)
    expect(resultado.resumen.movimientos).toBe(30)
    expect(resultado.resumen.gastos).toBe(-300)
    expect(resultado.resumen.truncado).toBe(false)
  })

  it("separa ingresos y gastos y calcula el neto redondeado", async () => {
    const { resultado } = await buscar(
      {},
      tablas([
        movimiento({ importe: 100.1 }),
        movimiento({ importe: 0.2 }),
        movimiento({ importe: -50.15 }),
      ]),
    )
    expect(resultado.resumen.ingresos).toBe(100.3)
    expect(resultado.resumen.gastos).toBe(-50.15)
    expect(resultado.resumen.neto).toBe(50.15)
  })

  it("desglosa por delegación con su ficha", async () => {
    const t = tablas([
      movimiento({ importe: -20 }),
      movimiento({ delegacion_id: MAD.id, cuenta_id: CUENTA_MAD.id, importe: -5 }),
    ])
    const { resultado } = await buscar({}, t)
    const nombres = resultado.resumen.por_delegacion.map((d) => d.delegacion?.nombre)
    expect(nombres).toEqual(expect.arrayContaining(["Sevilla", "Madrid"]))
  })

  it("el resumen respeta los mismos filtros que la búsqueda", async () => {
    const t = tablas([
      movimiento({ importe: -20, concepto: "COMPRA MERCADONA" }),
      movimiento({ importe: -900, concepto: "OTRA COSA" }),
    ])
    const { resultado } = await buscar({ texto: "mercadona" }, t)
    expect(resultado.resumen.gastos).toBe(-20)
    expect(resultado.resumen.movimientos).toBe(1)
  })

  it("pagina el resumen de mil en mil, ordenando por id", async () => {
    const muchos = Array.from({ length: 1500 }, () => movimiento({ importe: -1 }))
    const { resultado, admin } = await buscar({ limite: 10 }, tablas(muchos))

    expect(resultado.resumen.movimientos).toBe(1500)
    expect(resultado.resumen.gastos).toBe(-1500)
    const paginas = admin.consultas.filter((c: any) => c.tabla === "movimiento" && c.orden === "id")
    expect(paginas.length).toBe(2)
  })
})

describe("obtenerMovimiento y actualizarMovimiento", () => {
  it("obtenerMovimiento devuelve null si no existe", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const admin = crearFakeAdmin(tablas()) as any
    expect(await mod.obtenerMovimiento(admin, "mov-x")).toBeNull()
  })

  it("actualizarMovimiento guarda solo lo enviado", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const t = tablas([movimiento({ id: "mov-1", notas: null })])
    const admin = crearFakeAdmin(t) as any
    await mod.actualizarMovimiento(admin, "mov-1", { notas: "Revisar" })
    expect(admin.tablas.movimiento[0].notas).toBe("Revisar")
    expect(admin.tablas.movimiento[0].concepto).toBe("COMPRA MERCADONA")
  })

  it("actualizar un movimiento inexistente da 404", async () => {
    const mod = await import("@/lib/api/movimientos-public")
    const admin = crearFakeAdmin(tablas()) as any
    await expect(mod.actualizarMovimiento(admin, "mov-x", { notas: "x" })).rejects.toMatchObject({
      status: 404,
    })
  })
})
