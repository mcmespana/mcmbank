import { describe, it, expect } from "vitest"
import {
  cursoLabel,
  periodoRango,
  computeValores,
  computeDescuadres,
  computeResumen,
  buildPreview,
  type MemoriaContext,
  type MapeoConfig,
  type MapeoFila,
} from "@/lib/services/memoria-economica"

/**
 * El motor de cálculo de la memoria económica anual: lo que decide qué
 * números salen en un informe que se manda fuera de la organización. Lo
 * importante no es la integración con Sheets (eso no se puede probar sin
 * red), sino la aritmética: que el saldo inicial, los ingresos/gastos por
 * categoría (con sus subcategorías) y la validación de que "cuadra" sean
 * correctos — y que un movimiento sin categoría, o contado dos veces, se
 * detecte en vez de desaparecer en silencio.
 */

type Categoria = MemoriaContext["categorias"][number]
type Mov = MemoriaContext["movs"][number]

const DEL = "del-1"

function categoria(over: Partial<Categoria> & { id: string; nombre: string }): Categoria {
  return {
    es_global: true,
    orden: null,
    esta_activa: true,
    delegacion_id: null,
    categoria_padre_id: null,
    ...over,
  }
}

function mov(over: Partial<Mov> & { id: string; fecha: string; importe: number }): Mov {
  return { cuenta_id: "cta-banco", concepto: "Movimiento", categoria_id: null, ...over }
}

function contexto(params: {
  categorias?: Categoria[]
  movs?: Mov[]
  periodoTipo?: "curso" | "natural"
  anio?: number
  cuentas?: Record<string, "banco" | "caja">
}): MemoriaContext {
  const categorias = params.categorias ?? []
  const catById = new Map(categorias.map((c) => [c.id, c]))
  const childrenByParent = new Map<string, Categoria[]>()
  for (const c of categorias) {
    if (c.categoria_padre_id) {
      const arr = childrenByParent.get(c.categoria_padre_id) ?? []
      arr.push(c)
      childrenByParent.set(c.categoria_padre_id, arr)
    }
  }
  const periodoTipo = params.periodoTipo ?? "curso"
  const anio = params.anio ?? 2025
  return {
    delegacionId: DEL,
    delegacionNombre: "MCM Sevilla",
    periodoTipo,
    anio,
    rango: periodoRango(periodoTipo, anio),
    categorias,
    catById,
    childrenByParent,
    cuentaTipoById: new Map(Object.entries(params.cuentas ?? { "cta-banco": "banco", "cta-caja": "caja" })),
    movs: params.movs ?? [],
  }
}

function fila(over: Partial<MapeoFila> & { id: string; capitulo: MapeoFila["capitulo"] }): MapeoFila {
  return { fila: 1, descripcion: over.id, escribirDescripcion: false, enabled: true, ...over }
}

// ---------------------------------------------------------------------------

describe("cursoLabel / periodoRango", () => {
  it("un curso escolar va de 1 de septiembre a 1 de septiembre del año siguiente", () => {
    expect(cursoLabel(2025)).toBe("2025-2026")
    expect(periodoRango("curso", 2025)).toMatchObject({
      inicio: "2025-09-01",
      fin: "2026-09-01",
      label: "2025-2026",
    })
  })

  it("un año natural va de 1 de enero a 1 de enero del siguiente", () => {
    expect(periodoRango("natural", 2025)).toMatchObject({ inicio: "2025-01-01", fin: "2026-01-01", label: "2025" })
  })
})

// ---------------------------------------------------------------------------

describe("computeValores", () => {
  it("suma una categoría junto con sus subcategorías, solo dentro del periodo", () => {
    const alim = categoria({ id: "cat-alim", nombre: "Alimentación" })
    const alimSub = categoria({ id: "cat-alim-sub", nombre: "Alimentación · comedor", categoria_padre_id: "cat-alim" })
    const ctx = contexto({
      categorias: [alim, alimSub],
      movs: [
        mov({ id: "m1", fecha: "2025-10-01", categoria_id: "cat-alim", importe: -100 }),
        mov({ id: "m2", fecha: "2025-10-02", categoria_id: "cat-alim-sub", importe: -30 }),
        mov({ id: "m3", fecha: "2024-10-02", categoria_id: "cat-alim", importe: -999 }), // fuera de periodo
      ],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "gasto-alim", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-alim" } })],
    }
    const { valores } = computeValores(ctx, mapeo)
    expect(valores["gasto-alim"].gasto).toBe(130)
  })

  it("una fila deshabilitada no se calcula", () => {
    const ctx = contexto({ categorias: [categoria({ id: "c1", nombre: "X" })] })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "II", enabled: false, gasto: { tipo: "categoria", categoriaId: "c1" } })],
    }
    const { valores } = computeValores(ctx, mapeo)
    expect(valores["f1"]).toBeUndefined()
  })

  it("una fuente literal no depende de ningún movimiento", () => {
    const ctx = contexto({})
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "II", gasto: { tipo: "literal", valor: 42 } })],
    }
    const { valores } = computeValores(ctx, mapeo)
    expect(valores["f1"].gasto).toBe(42)
  })

  it("el saldo_inicial suma solo los movimientos anteriores al periodo, de ese tipo de cuenta", () => {
    const ctx = contexto({
      movs: [
        mov({ id: "m1", fecha: "2025-06-01", cuenta_id: "cta-banco", importe: 500 }),
        mov({ id: "m2", fecha: "2025-06-01", cuenta_id: "cta-caja", importe: 50 }),
        mov({ id: "m3", fecha: "2025-10-01", cuenta_id: "cta-banco", importe: 999 }), // dentro del periodo, no cuenta
      ],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "saldo-banco", capitulo: "I", ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" } })],
    }
    const { valores } = computeValores(ctx, mapeo)
    expect(valores["saldo-banco"].ingreso).toBe(500)
  })

  it("avisa si una categoría mapeada tiene subcategorías con movimientos propios", () => {
    const padre = categoria({ id: "cat-p", nombre: "Padre" })
    const hijo = categoria({ id: "cat-h", nombre: "Hijo", categoria_padre_id: "cat-p" })
    const ctx = contexto({
      categorias: [padre, hijo],
      movs: [mov({ id: "m1", fecha: "2025-10-01", categoria_id: "cat-h", importe: -10 })],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-p" } })],
    }
    const { avisos } = computeValores(ctx, mapeo)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ tipo: "subcategoria" })
  })

  it("no avisa si la subcategoría existe pero no tiene ningún movimiento en el periodo", () => {
    const padre = categoria({ id: "cat-p", nombre: "Padre" })
    const hijo = categoria({ id: "cat-h", nombre: "Hijo", categoria_padre_id: "cat-p" })
    const ctx = contexto({ categorias: [padre, hijo] })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-p" } })],
    }
    const { avisos } = computeValores(ctx, mapeo)
    expect(avisos).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------

describe("computeDescuadres", () => {
  it("un movimiento sin categoría se marca como 'sin_categoria'", () => {
    const ctx = contexto({ movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: null })] })
    const descuadres = computeDescuadres(ctx, { filas: [] })
    expect(descuadres).toEqual([expect.objectContaining({ id: "m1", motivo: "sin_categoria" })])
  })

  it("una categoría que ninguna fila recoge se marca como 'categoria_sin_fila'", () => {
    const ctx = contexto({
      categorias: [categoria({ id: "cat-huerfana", nombre: "Sin mapear" })],
      movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: "cat-huerfana" })],
    })
    const descuadres = computeDescuadres(ctx, { filas: [] })
    expect(descuadres[0].motivo).toBe("categoria_sin_fila")
  })

  it("una categoría recogida por dos filas distintas se marca 'doble_contado'", () => {
    const cat = categoria({ id: "cat-1", nombre: "Repetida" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: "cat-1" })],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
        fila({ id: "f2", capitulo: "III", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
      ],
    }
    const descuadres = computeDescuadres(ctx, mapeo)
    expect(descuadres[0]).toMatchObject({ motivo: "doble_contado", veces: 2 })
  })

  it("una categoría recogida por exactamente una fila no descuadra", () => {
    const cat = categoria({ id: "cat-1", nombre: "Bien mapeada" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: "cat-1" })],
    })
    const mapeo: MapeoConfig = { filas: [fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-1" } })] }
    expect(computeDescuadres(ctx, mapeo)).toEqual([])
  })

  it("las filas del capítulo I (saldos) no cuentan para detectar doble conteo", () => {
    // Cap I es el remanente, no un gasto/ingreso del periodo: si contase, cualquier
    // categoría usada también en un saldo se marcaría como doblemente contada sin motivo.
    const cat = categoria({ id: "cat-1", nombre: "X" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: "cat-1" })],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "cap1", capitulo: "I", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
        fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
      ],
    }
    expect(computeDescuadres(ctx, mapeo)).toEqual([])
  })

  it("un capítulo excluido no cuenta como fila que recoge la categoría", () => {
    const cat = categoria({ id: "cat-1", nombre: "X" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", importe: -20, categoria_id: "cat-1" })],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "VI", gasto: { tipo: "categoria", categoriaId: "cat-1" } })],
      capitulosExcluidos: ["VI"],
    }
    expect(computeDescuadres(ctx, mapeo)[0].motivo).toBe("categoria_sin_fila")
  })

  it("se ordena por importe absoluto descendente", () => {
    const ctx = contexto({
      movs: [
        mov({ id: "pequeno", fecha: "2025-10-01", importe: -5, categoria_id: null }),
        mov({ id: "grande", fecha: "2025-10-02", importe: 500, categoria_id: null }),
        mov({ id: "mediano", fecha: "2025-10-03", importe: -50, categoria_id: null }),
      ],
    })
    const descuadres = computeDescuadres(ctx, { filas: [] })
    expect(descuadres.map((d) => d.id)).toEqual(["grande", "mediano", "pequeno"])
  })
})

// ---------------------------------------------------------------------------

describe("computeResumen", () => {
  function escenario() {
    const cat = categoria({ id: "cat-gasto", nombre: "Gasto" })
    const ctx = contexto({
      categorias: [cat],
      movs: [
        mov({ id: "saldo", fecha: "2025-06-01", cuenta_id: "cta-banco", importe: 1000 }), // remanente
        mov({ id: "gasto", fecha: "2025-10-01", cuenta_id: "cta-banco", categoria_id: "cat-gasto", importe: -300 }),
        mov({ id: "ingreso", fecha: "2025-10-02", cuenta_id: "cta-banco", importe: 200 }), // sin categoría: no recogido
      ],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "cap1", capitulo: "I", ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" } }),
        fila({ id: "f-gasto", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-gasto" } }),
      ],
    }
    return { ctx, mapeo }
  }

  it("cuadra cuando el informe recoge exactamente el dinero real del periodo", () => {
    const cat = categoria({ id: "cat-gasto", nombre: "Gasto" })
    const ctx = contexto({
      categorias: [cat],
      movs: [
        mov({ id: "saldo", fecha: "2025-06-01", cuenta_id: "cta-banco", importe: 1000 }),
        mov({ id: "gasto", fecha: "2025-10-01", cuenta_id: "cta-banco", categoria_id: "cat-gasto", importe: -300 }),
      ],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "cap1", capitulo: "I", ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" } }),
        fila({ id: "f-gasto", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-gasto" } }),
      ],
    }
    const { valores } = computeValores(ctx, mapeo)
    const resumen = computeResumen(ctx, mapeo, valores)

    expect(resumen.remanenteBanco).toBe(1000)
    expect(resumen.informeGastos).toBe(300)
    expect(resumen.balanceEjercicio).toBe(-300)
    expect(resumen.disponibleFinal).toBe(700)
    expect(resumen.saldoFinalReal).toBe(700)
    expect(resumen.descuadre).toBe(0)
    expect(resumen.cuadra).toBe(true)
  })

  it("un movimiento sin categoría descuadra el informe y se contabiliza en 'no recogido'", () => {
    const { ctx, mapeo } = escenario()
    const { valores } = computeValores(ctx, mapeo)
    const resumen = computeResumen(ctx, mapeo, valores)

    // El real incluye el ingreso de 200 sin categoría; el informe no.
    expect(resumen.realIngresos).toBe(200)
    expect(resumen.informeIngresos).toBe(0)
    expect(resumen.noRecogidoIngresos).toBe(200)
    expect(resumen.noRecogidoMovs).toBe(1)
    expect(resumen.cuadra).toBe(false)
    expect(resumen.descuadre).toBe(-200)
  })

  it("una diferencia menor de medio céntimo se considera que cuadra (redondeo)", () => {
    const cat = categoria({ id: "cat-gasto", nombre: "Gasto" })
    const ctx = contexto({
      categorias: [cat],
      movs: [
        mov({ id: "saldo", fecha: "2025-06-01", cuenta_id: "cta-banco", importe: 1000 }),
        mov({ id: "gasto", fecha: "2025-10-01", cuenta_id: "cta-banco", categoria_id: "cat-gasto", importe: -300 }),
      ],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "cap1", capitulo: "I", ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" } }),
        // Un literal ligerísimamente distinto simula un redondeo de céntimos.
        fila({ id: "f-gasto", capitulo: "II", gasto: { tipo: "literal", valor: 300.003 } }),
      ],
    }
    const { valores } = computeValores(ctx, mapeo)
    expect(computeResumen(ctx, mapeo, valores).cuadra).toBe(true)
  })

  it("una categoría contada dos veces se refleja en dobleContado, no en noRecogido", () => {
    const cat = categoria({ id: "cat-1", nombre: "X" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", categoria_id: "cat-1", importe: -100 })],
    })
    const mapeo: MapeoConfig = {
      filas: [
        fila({ id: "f1", capitulo: "II", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
        fila({ id: "f2", capitulo: "III", gasto: { tipo: "categoria", categoriaId: "cat-1" } }),
      ],
    }
    const { valores } = computeValores(ctx, mapeo)
    const resumen = computeResumen(ctx, mapeo, valores)
    expect(resumen.dobleContadoGastos).toBe(100)
    expect(resumen.noRecogidoGastos).toBe(0)
  })

  it("un capítulo excluido no suma al informe aunque sus filas sigan habilitadas", () => {
    const cat = categoria({ id: "cat-1", nombre: "X" })
    const ctx = contexto({
      categorias: [cat],
      movs: [mov({ id: "m1", fecha: "2025-10-01", categoria_id: "cat-1", importe: -100 })],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "f1", capitulo: "VI", gasto: { tipo: "categoria", categoriaId: "cat-1" } })],
      capitulosExcluidos: ["VI"],
    }
    const { valores } = computeValores(ctx, mapeo)
    const resumen = computeResumen(ctx, mapeo, valores)
    expect(resumen.informeGastos).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe("buildPreview", () => {
  it("un curso escolar usa el vocabulario de curso en los textos", () => {
    const ctx = contexto({ periodoTipo: "curso", anio: 2025 })
    const preview = buildPreview(ctx, { filas: [] })
    expect(preview.textos.capituloI).toContain("CURSO")
    expect(preview.textos.saldoBanco).toContain("1 septiembre")
  })

  it("un año natural usa el vocabulario de año en los textos", () => {
    const ctx = contexto({ periodoTipo: "natural", anio: 2025 })
    const preview = buildPreview(ctx, { filas: [] })
    expect(preview.textos.capituloI).toContain("AÑO")
    expect(preview.textos.saldoBanco).toContain("1 enero")
  })

  it("solo enseña categorías activas, ordenadas alfabéticamente", () => {
    const ctx = contexto({
      categorias: [
        categoria({ id: "c1", nombre: "Zeta", esta_activa: true }),
        categoria({ id: "c2", nombre: "Alfa", esta_activa: true }),
        categoria({ id: "c3", nombre: "Oculta", esta_activa: false }),
      ],
    })
    const preview = buildPreview(ctx, { filas: [] })
    expect(preview.categorias.map((c) => c.nombre)).toEqual(["Alfa", "Zeta"])
  })

  it("sin actividades detectadas para el parent indicado, avisa", () => {
    const ctx = contexto({ categorias: [categoria({ id: "cat-act", nombre: "Actividades" })] })
    const preview = buildPreview(ctx, { filas: [], actividadesParentId: "cat-act" })
    expect(preview.avisos).toEqual([
      expect.objectContaining({ tipo: "sin_actividades" }),
    ])
  })

  it("incluye la validación (resumen) calculada con el mapeo dado", () => {
    const ctx = contexto({
      movs: [mov({ id: "m1", fecha: "2025-06-01", cuenta_id: "cta-banco", importe: 500 })],
    })
    const mapeo: MapeoConfig = {
      filas: [fila({ id: "cap1", capitulo: "I", ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" } })],
    }
    const preview = buildPreview(ctx, mapeo)
    expect(preview.resumen.remanenteBanco).toBe(500)
    expect(preview.resumen.cuadra).toBe(true)
  })
})
