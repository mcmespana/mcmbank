import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * El resumen es la cifra que sale de esta app hacia fuera: la que ve la oficina
 * técnica por la API y por el MCP. Se agrega en JS (las RPC de Postgres no
 * sirven con la clave de servicio), así que las reglas de qué suma y qué no
 * viven aquí y solo aquí. Cada una tiene su caso.
 *
 * Los módulos de `lib/api` cachean catálogos y delegaciones durante 60 s a
 * nivel de módulo, así que cada test recarga los módulos para partir de cero.
 */

const DEL_A = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const DEL_B = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }

const CUENTA_A = { id: "cta-a", delegacion_id: DEL_A.id, nombre: "Corriente A", activa: true }
const CUENTA_B = { id: "cta-b", delegacion_id: DEL_B.id, nombre: "Corriente B", activa: true }
const CUENTA_CERRADA = { id: "cta-vieja", delegacion_id: DEL_A.id, nombre: "Antigua", activa: false }

const CAT_COMIDA = { id: "cat-comida", nombre: "Comida", emoji: "🍽", color: "#fff", esta_activa: true, orden: 1 }
const CAT_DONA = { id: "cat-dona", nombre: "Donativos", emoji: "🎁", color: "#0f0", esta_activa: true, orden: 2 }

let mov = 0
function movimiento(over: Record<string, any> = {}) {
  return {
    id: `mov-${String(++mov).padStart(4, "0")}`,
    delegacion_id: DEL_A.id,
    cuenta_id: CUENTA_A.id,
    categoria_id: CAT_COMIDA.id,
    importe: -10,
    fecha: "2026-03-15",
    ignorado: false,
    ...over,
  }
}

function tablas(movimientos: Record<string, any>[], extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [DEL_A, DEL_B],
    cuenta: [CUENTA_A, CUENTA_B, CUENTA_CERRADA],
    categoria: [CAT_COMIDA, CAT_DONA],
    contacto: [],
    movimiento: movimientos,
    factura: [],
    aviso: [],
    ...extra,
  }
}

async function resumir(t: Tablas, params: Record<string, any> = {}, opciones = {}) {
  const { resumenGeneral } = await import("@/lib/api/resumen")
  const admin = crearFakeAdmin(t, opciones)
  const resultado = await resumenGeneral(admin as any, params)
  return { resultado, admin }
}

beforeEach(() => {
  mov = 0
  vi.resetModules()
})

describe("resumenGeneral · totales", () => {
  it("separa ingresos de gastos y calcula el neto", async () => {
    const { resultado } = await resumir(
      tablas([
        movimiento({ importe: 100, categoria_id: CAT_DONA.id }),
        movimiento({ importe: -30 }),
        movimiento({ importe: -20 }),
      ]),
    )

    expect(resultado.totales).toMatchObject({
      movimientos: 3,
      ingresos: 100,
      gastos: -50,
      neto: 50,
    })
  })

  it("un importe de cero cuenta como ingreso, no se pierde", async () => {
    const { resultado } = await resumir(tablas([movimiento({ importe: 0 })]))
    expect(resultado.totales.movimientos).toBe(1)
    expect(resultado.totales.ingresos).toBe(0)
  })

  it("redondea a dos decimales: nada de 0.30000000000000004", async () => {
    const { resultado } = await resumir(
      tablas([movimiento({ importe: 0.1 }), movimiento({ importe: 0.2 })]),
    )
    expect(resultado.totales.ingresos).toBe(0.3)
  })

  it("sin movimientos devuelve ceros y todas las delegaciones", async () => {
    const { resultado } = await resumir(tablas([]))
    expect(resultado.totales).toMatchObject({ delegaciones: 2, movimientos: 0, ingresos: 0, gastos: 0 })
    expect(resultado.por_delegacion).toHaveLength(2)
  })
})

describe("resumenGeneral · qué entra en la cuenta y qué no", () => {
  it("los movimientos ignorados no cuentan… salvo que se pidan", async () => {
    const t = tablas([movimiento({ importe: -10 }), movimiento({ importe: -90, ignorado: true })])

    expect((await resumir(t)).resultado.totales.gastos).toBe(-10)

    vi.resetModules()
    expect((await resumir(t, { incluirIgnorados: true })).resultado.totales.gastos).toBe(-100)
  })

  it("los movimientos de una cuenta desactivada no cuentan como gasto", async () => {
    const { resultado } = await resumir(
      tablas([movimiento({ importe: -10 }), movimiento({ importe: -500, cuenta_id: CUENTA_CERRADA.id })]),
    )
    expect(resultado.totales.gastos).toBe(-10)
    expect(resultado.totales.movimientos).toBe(1)
  })

  it("el rango de fechas acota ingresos y gastos, por los dos extremos", async () => {
    const t = tablas([
      movimiento({ importe: -1, fecha: "2025-12-31" }),
      movimiento({ importe: -10, fecha: "2026-01-01" }),
      movimiento({ importe: -100, fecha: "2026-06-30" }),
      movimiento({ importe: -1000, fecha: "2026-07-01" }),
    ])

    const { resultado } = await resumir(t, { desde: "2026-01-01", hasta: "2026-06-30" })
    // Los extremos entran (>= y <=).
    expect(resultado.totales.gastos).toBe(-110)
    expect(resultado.desde).toBe("2026-01-01")
    expect(resultado.hasta).toBe("2026-06-30")
  })

  it("el saldo es el extracto del banco: incluye lo ignorado y no mira fechas", async () => {
    const { resultado } = await resumir(
      tablas([
        movimiento({ importe: 1000, fecha: "2020-01-01" }),
        movimiento({ importe: -50, ignorado: true }),
      ]),
      { desde: "2026-01-01" },
    )

    const sevilla = resultado.por_delegacion.find((d) => d.delegacion.id === DEL_A.id)!
    expect(sevilla.saldo).toBe(950)
    // …pero de ingresos y gastos del periodo no cuenta ninguno de los dos.
    expect(sevilla.ingresos).toBe(0)
    expect(sevilla.gastos).toBe(0)
  })

  it("el saldo no cuenta las cuentas desactivadas", async () => {
    const { resultado } = await resumir(
      tablas([movimiento({ importe: 500, cuenta_id: CUENTA_CERRADA.id })]),
    )
    expect(resultado.totales.saldo).toBe(0)
  })
})

describe("resumenGeneral · ámbito de delegaciones", () => {
  it("sin filtro salen todas", async () => {
    const { resultado } = await resumir(
      tablas([movimiento({ importe: -10 }), movimiento({ importe: -20, delegacion_id: DEL_B.id, cuenta_id: CUENTA_B.id })]),
    )
    expect(resultado.por_delegacion.map((d) => d.delegacion.nombre).sort()).toEqual([
      "Madrid",
      "Sevilla",
    ])
    expect(resultado.totales.gastos).toBe(-30)
  })

  it("filtrando por nombre solo sale esa, y sus cifras", async () => {
    const { resultado } = await resumir(
      tablas([
        movimiento({ importe: -10 }),
        movimiento({ importe: -20, delegacion_id: DEL_B.id, cuenta_id: CUENTA_B.id }),
      ]),
      { delegaciones: "Madrid" },
    )

    expect(resultado.por_delegacion).toHaveLength(1)
    expect(resultado.por_delegacion[0].delegacion.nombre).toBe("Madrid")
    expect(resultado.totales.gastos).toBe(-20)
  })

  it("el filtro se aplica en la consulta, no solo al pintar", async () => {
    const { admin } = await resumir(tablas([movimiento({})]), { delegaciones: ["Sevilla"] })
    const consultaMovimientos = admin.consultas.find((c) => c.tabla === "movimiento")!
    expect(consultaMovimientos.filtros).toContain("in:delegacion_id")
  })

  it("cuenta las cuentas activas de cada delegación", async () => {
    const { resultado } = await resumir(tablas([]))
    const sevilla = resultado.por_delegacion.find((d) => d.delegacion.id === DEL_A.id)!
    // Sevilla tiene dos cuentas pero una está desactivada.
    expect(sevilla.cuentas).toBe(1)
  })
})

describe("resumenGeneral · desglose por categoría", () => {
  it("agrupa por categoría con su nombre y emoji", async () => {
    const { resultado } = await resumir(
      tablas([
        movimiento({ importe: -30, categoria_id: CAT_COMIDA.id }),
        movimiento({ importe: -20, categoria_id: CAT_COMIDA.id }),
        movimiento({ importe: 100, categoria_id: CAT_DONA.id }),
      ]),
    )

    const comida = resultado.por_categoria.find((c) => c.categoria?.nombre === "Comida")!
    expect(comida).toMatchObject({ movimientos: 2, gastos: -50, ingresos: 0, neto: -50 })
    expect(comida.categoria?.emoji).toBe("🍽")
  })

  it("los movimientos sin categoría se agrupan aparte, sin ficha", async () => {
    const { resultado } = await resumir(tablas([movimiento({ categoria_id: null, importe: -7 })]))
    const sinCategoria = resultado.por_categoria.find((c) => c.categoria === null)!
    expect(sinCategoria.gastos).toBe(-7)
  })

  it("ordena poniendo delante lo que más gasta", async () => {
    const { resultado } = await resumir(
      tablas([
        movimiento({ importe: -5, categoria_id: CAT_COMIDA.id }),
        movimiento({ importe: -500, categoria_id: CAT_DONA.id }),
      ]),
    )
    expect(resultado.por_categoria[0].categoria?.nombre).toBe("Donativos")
  })
})

describe("resumenGeneral · contadores pendientes", () => {
  it("cuenta facturas sin pagar y avisos pendientes por delegación", async () => {
    const { resultado } = await resumir(
      tablas([], {
        factura: [
          { delegacion_id: DEL_A.id, estado: "bandeja" },
          { delegacion_id: DEL_A.id, estado: "sin_pagar" },
          { delegacion_id: DEL_A.id, estado: "pagada" },
          { delegacion_id: DEL_A.id, estado: "pagada_fuera" },
          { delegacion_id: DEL_B.id, estado: "sin_pagar" },
        ],
        aviso: [
          { delegacion_id: DEL_A.id, estado: "pendiente" },
          { delegacion_id: DEL_A.id, estado: "hecha" },
        ],
      }),
    )

    const sevilla = resultado.por_delegacion.find((d) => d.delegacion.id === DEL_A.id)!
    const madrid = resultado.por_delegacion.find((d) => d.delegacion.id === DEL_B.id)!
    expect(sevilla.facturas_pendientes).toBe(2)
    expect(sevilla.avisos_pendientes).toBe(1)
    expect(madrid.facturas_pendientes).toBe(1)
    expect(madrid.avisos_pendientes).toBe(0)
  })
})

describe("resumenGeneral · paginación", () => {
  it("junta todas las páginas y ordena por id (si no, las páginas se solapan)", async () => {
    // 1200 movimientos de 1 € obligan a pedir dos páginas de 1000.
    const muchos = Array.from({ length: 1200 }, () => movimiento({ importe: 1 }))
    const { resultado, admin } = await resumir(tablas(muchos))

    expect(resultado.totales.movimientos).toBe(1200)
    expect(resultado.totales.ingresos).toBe(1200)
    expect(resultado.truncado).toBe(false)

    const consultas = admin.consultas.filter((c) => c.tabla === "movimiento")
    expect(consultas.length).toBe(2)
    expect(consultas.every((c) => c.orden === "id")).toBe(true)
    expect(consultas[0].rango).toEqual([0, 999])
    expect(consultas[1].rango).toEqual([1000, 1999])
  })

  it("no pide una página de más cuando el total es múltiplo exacto", async () => {
    const { admin } = await resumir(tablas(Array.from({ length: 999 }, () => movimiento({}))))
    expect(admin.consultas.filter((c) => c.tabla === "movimiento").length).toBe(1)
  })
})

describe("resumenGeneral · errores", () => {
  it("un fallo leyendo movimientos se propaga con mensaje legible", async () => {
    await expect(
      resumir(tablas([]), {}, { errores: { movimiento: { message: "conexión perdida" } } }),
    ).rejects.toThrow("conexión perdida")
  })

  it("una delegación que no existe se rechaza en vez de devolver todo", async () => {
    await expect(resumir(tablas([]), { delegaciones: "Cuenca" })).rejects.toThrow()
  })
})
