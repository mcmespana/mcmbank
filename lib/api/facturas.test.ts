import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Facturas: crear, vincular con el banco y conciliar en lote.
 *
 * La regla de oro del módulo es que **nada se concilia solo si hay la menor
 * duda**: una conciliación equivocada cuesta más de deshacer que de revisar.
 * Los tests de `conciliarLote` son sobre todo para eso — comprobar cuándo NO
 * vincula.
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const MAD = { id: "bbbbbbbb-0000-0000-0000-000000000002", codigo: "MAD", nombre: "Madrid" }
const ACTOR = "11111111-1111-1111-1111-111111111111"

const CUENTA = { id: "cta-sev", delegacion_id: SEV.id, nombre: "Corriente", activa: true }
const CATEGORIA = {
  id: "cat-1",
  nombre: "Alimentación",
  es_global: true,
  delegacion_id: null,
  orden: 1,
  esta_activa: true,
}

function movimiento(over: Record<string, any> = {}) {
  return {
    id: "mov-1",
    delegacion_id: SEV.id,
    cuenta_id: CUENTA.id,
    categoria_id: null,
    contacto_id: null,
    factura_id: null,
    concepto: "COMPRA TARJETA",
    contraparte: null,
    descripcion: null,
    importe: -42.5,
    fecha: "2026-03-10",
    ignorado: false,
    ...over,
  }
}

function factura(over: Record<string, any> = {}) {
  return {
    id: "fac-1",
    delegacion_id: SEV.id,
    numero: "A-1",
    concepto: "Compra",
    importe: 42.5,
    fecha_emision: "2026-03-10",
    moneda: "EUR",
    estado: "bandeja",
    origen: "subida",
    notas: null,
    contacto_id: null,
    categoria_id: null,
    datos_ia: null,
    creado_en: "2026-03-10T10:00:00Z",
    actualizado_en: "2026-03-10T10:00:00Z",
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV, MAD],
    cuenta: [CUENTA],
    categoria: [CATEGORIA],
    contacto: [],
    factura: [],
    movimiento: [],
    archivo_adjunto: [],
    movimiento_archivo: [],
    ...extra,
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function api(t: Tablas = tablas()) {
  const mod = await import("@/lib/api/facturas")
  return { mod, admin: crearFakeAdmin(t) as any }
}

// ---------------------------------------------------------------------------

describe("serializeFactura", () => {
  it("calcula lo pagado y lo pendiente a partir de los movimientos vinculados", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(
      { ...factura({ importe: 100 }), movimientos: [{ id: "m1", fecha: "2026-03-10", concepto: "Pago", importe: -40 }] },
      [],
      new Map([[SEV.id, SEV]]),
    )
    expect(salida.importe_pagado).toBe(40)
    expect(salida.importe_pendiente).toBe(60)
  })

  it("suma los pagos en varios plazos, en valor absoluto", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(
      {
        ...factura({ importe: 100 }),
        movimientos: [
          { id: "m1", fecha: "2026-03-10", concepto: "1/2", importe: -60 },
          { id: "m2", fecha: "2026-04-10", concepto: "2/2", importe: -40 },
        ],
      },
      [],
      new Map(),
    )
    expect(salida.importe_pagado).toBe(100)
    expect(salida.importe_pendiente).toBe(0)
  })

  it("el pendiente nunca es negativo aunque se pague de más", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(
      { ...factura({ importe: 50 }), movimientos: [{ id: "m1", fecha: "x", concepto: "y", importe: -80 }] },
      [],
      new Map(),
    )
    expect(salida.importe_pendiente).toBe(0)
  })

  it("una factura sin importe deja el pendiente en null, no en cero", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(factura({ importe: null }), [], new Map())
    expect(salida.importe).toBeNull()
    expect(salida.importe_pendiente).toBeNull()
    expect(salida.importe_pagado).toBe(0)
  })

  it("redondea a dos decimales", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(
      {
        ...factura({ importe: 0.3 }),
        movimientos: [
          { id: "m1", fecha: "x", concepto: "y", importe: -0.1 },
          { id: "m2", fecha: "x", concepto: "y", importe: -0.2 },
        ],
      },
      [],
      new Map(),
    )
    expect(salida.importe_pagado).toBe(0.3)
    expect(salida.importe_pendiente).toBe(0)
  })

  it("adjunta la delegación y por defecto la moneda es el euro", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(
      factura({ moneda: null }),
      [],
      new Map([[SEV.id, SEV]]),
    )
    expect(salida.delegacion).toEqual(SEV)
    expect(salida.moneda).toBe("EUR")
  })

  it("sin contacto ni categoría devuelve null, no undefined", async () => {
    const { mod } = await api()
    const salida = mod.serializeFactura(factura(), [], new Map())
    expect(salida.contacto).toBeNull()
    expect(salida.categoria).toBeNull()
    expect(salida.movimientos).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe("crearFactura", () => {
  it("guarda la factura con los valores por defecto (bandeja, EUR)", async () => {
    const { mod, admin } = await api()
    const creada = await mod.crearFactura(
      admin,
      { delegacion: "Sevilla", concepto: "  Compra material  ", importe: 30 },
      ACTOR,
    )
    expect(creada.estado).toBe("bandeja")
    expect(creada.moneda).toBe("EUR")
    expect(creada.concepto).toBe("Compra material")
    expect(admin.tablas.factura[0].creado_por).toBe(ACTOR)
  })

  it("el importe se guarda siempre en positivo", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearFactura(admin, { delegacion: "Sevilla", importe: -30 }, ACTOR),
    ).rejects.toThrow("debe ser positivo")
  })

  it("un importe cero tampoco vale", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearFactura(admin, { delegacion: "Sevilla", importe: 0 }, ACTOR),
    ).rejects.toThrow("positivo")
  })

  it("rechaza un estado inventado y publica los válidos", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.crearFactura(admin, { delegacion: "Sevilla", estado: "en_tramite" as any }, ACTOR),
    ).rejects.toMatchObject({ status: 400, detalles: { estados_validos: expect.any(Array) } })
  })

  it("una delegación que no existe se rechaza antes de insertar nada", async () => {
    const { mod, admin } = await api()
    await expect(mod.crearFactura(admin, { delegacion: "Cuenca" }, ACTOR)).rejects.toThrow()
    expect(admin.tablas.factura).toHaveLength(0)
  })
})

describe("actualizarFactura", () => {
  it("aplica solo los campos enviados", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    await mod.actualizarFactura(admin, "fac-1", { concepto: "Otro concepto" })
    expect(admin.tablas.factura[0].concepto).toBe("Otro concepto")
    expect(admin.tablas.factura[0].numero).toBe("A-1")
  })

  it("sin ningún cambio avisa en vez de hacer una escritura vacía", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    await expect(mod.actualizarFactura(admin, "fac-1", {})).rejects.toThrow("ningún cambio")
  })

  it("una factura inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.actualizarFactura(admin, "fac-x", { notas: "hola" })).rejects.toMatchObject({
      status: 404,
    })
  })

  it("también aquí el importe se guarda en positivo", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    await expect(mod.actualizarFactura(admin, "fac-1", { importe: -5 })).rejects.toThrow("positivo")
  })

  it("permite poner el importe a null (aún no se sabe)", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    await mod.actualizarFactura(admin, "fac-1", { importe: null })
    expect(admin.tablas.factura[0].importe).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe("vincularFacturaAMovimiento", () => {
  it("vincula y deja la referencia en el movimiento", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()], movimiento: [movimiento()] }))
    await mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)
    expect(admin.tablas.movimiento[0].factura_id).toBe("fac-1")
  })

  it("es idempotente: vincular lo ya vinculado no falla ni duplica", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ factura_id: "fac-1" })] }),
    )
    await expect(mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)).resolves.toBeUndefined()
    expect(admin.escrituras).toHaveLength(0)
  })

  it("no roba un movimiento que ya tiene otra factura", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ factura_id: "fac-otra" })] }),
    )
    await expect(mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)).rejects.toMatchObject({
      status: 409,
    })
    expect(admin.tablas.movimiento[0].factura_id).toBe("fac-otra")
  })

  it("no concilia entre delegaciones distintas", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ delegacion_id: MAD.id })] }),
    )
    await expect(mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("delegaciones distintas"),
    })
    expect(admin.tablas.movimiento[0].factura_id).toBeNull()
  })

  it("propaga contacto y categoría de la factura al movimiento solo si están vacíos", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [factura({ contacto_id: "con-1", categoria_id: "cat-1" })],
        movimiento: [movimiento({ categoria_id: "cat-ya-puesta" })],
      }),
    )
    await mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)
    expect(admin.tablas.movimiento[0].contacto_id).toBe("con-1")
    // La categoría que ya tenía el movimiento no se pisa.
    expect(admin.tablas.movimiento[0].categoria_id).toBe("cat-ya-puesta")
  })

  it("rellena los huecos de la factura con los datos del movimiento", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [factura({ importe: null, fecha_emision: null, contacto_id: null })],
        movimiento: [movimiento({ importe: -77.4, fecha: "2026-02-01", contacto_id: "con-9" })],
      }),
    )
    await mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)
    const guardada = admin.tablas.factura[0]
    // El importe de la factura es lo que hay que pagar: positivo.
    expect(guardada.importe).toBe(77.4)
    expect(guardada.fecha_emision).toBe("2026-02-01")
    expect(guardada.contacto_id).toBe("con-9")
  })

  it("no pisa los datos que la factura ya tenía", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [factura({ importe: 42.5, fecha_emision: "2026-03-10" })],
        movimiento: [movimiento({ importe: -99, fecha: "2026-01-01" })],
      }),
    )
    await mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-1", ACTOR)
    expect(admin.tablas.factura[0].importe).toBe(42.5)
    expect(admin.tablas.factura[0].fecha_emision).toBe("2026-03-10")
  })

  it("una factura o un movimiento inexistentes dan 404", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(mod.vincularFacturaAMovimiento(admin, "fac-x", "mov-1", ACTOR)).rejects.toMatchObject({
      status: 404,
    })
    await expect(mod.vincularFacturaAMovimiento(admin, "fac-1", "mov-x", ACTOR)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe("desvincularFacturaDeMovimiento", () => {
  it("borra la referencia del movimiento", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ factura_id: "fac-1" })] }),
    )
    await mod.desvincularFacturaDeMovimiento(admin, "fac-1", "mov-1")
    expect(admin.tablas.movimiento[0].factura_id).toBeNull()
  })

  it("si no estaban vinculados avisa en vez de callar", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ factura_id: "otra" })] }),
    )
    await expect(mod.desvincularFacturaDeMovimiento(admin, "fac-1", "mov-1")).rejects.toMatchObject({
      status: 404,
    })
    // Y no toca el vínculo ajeno.
    expect(admin.tablas.movimiento[0].factura_id).toBe("otra")
  })
})

// ---------------------------------------------------------------------------

describe("conciliarLote · validaciones", () => {
  it("un lote vacío se rechaza", async () => {
    const { mod, admin } = await api()
    await expect(mod.conciliarLote(admin, { items: [] }, ACTOR)).rejects.toThrow("ninguna factura")
  })

  it("más de 100 líneas de golpe se rechazan", async () => {
    const { mod, admin } = await api()
    const items = Array.from({ length: 101 }, (_, i) => ({ importe: i + 1 }))
    await expect(mod.conciliarLote(admin, { items }, ACTOR)).rejects.toThrow("demasiadas")
  })

  it("aplicar sin saber quién firma se rechaza", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.conciliarLote(admin, { items: [{ importe: 10 }], aplicar: true }, null),
    ).rejects.toThrow("quién la firma")
  })
})

describe("conciliarLote · propone pero no toca nada", () => {
  it("por defecto no vincula, aunque el match sea perfecto", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento()] }),
    )
    const res = await mod.conciliarLote(
      admin,
      { items: [{ importe: 42.5, fecha: "2026-03-10", factura_id: "fac-1" }] },
      ACTOR,
    )
    expect(res.resultados[0].match_directo).toBe(true)
    expect(res.vinculados).toBe(0)
    expect(admin.tablas.movimiento[0].factura_id).toBeNull()
  })

  it("devuelve los motivos en texto para que se pueda decidir con criterio", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.conciliarLote(admin, { items: [{ importe: 42.5, fecha: "2026-03-10" }] }, ACTOR)
    expect(res.resultados[0].candidatos[0].motivos).toContain("importe exacto")
  })

  it("cuenta las líneas sin ningún candidato", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.conciliarLote(admin, { items: [{ importe: 999 }] }, ACTOR)
    expect(res.sin_candidatos).toBe(1)
    expect(res.resultados[0].match_directo).toBe(false)
  })
})

describe("conciliarLote · cuándo sí vincula y cuándo no", () => {
  it("con aplicar y match directo, vincula", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()], movimiento: [movimiento()] }))
    const res = await mod.conciliarLote(
      admin,
      { items: [{ importe: 42.5, fecha: "2026-03-10", factura_id: "fac-1" }], aplicar: true },
      ACTOR,
    )
    expect(res.vinculados).toBe(1)
    expect(res.resultados[0].vinculado).toEqual({ factura_id: "fac-1", movimiento_id: "mov-1" })
    expect(admin.tablas.movimiento[0].factura_id).toBe("fac-1")
  })

  it("si el concepto nombra a OTRA cadena conocida, no vincula por mucho que el importe cuadre", async () => {
    // El caso real: la factura es de Mercadona y el apunte del mismo importe
    // es de Amazon. El importe exacto no basta.
    const { mod, admin } = await api(
      tablas({
        factura: [factura()],
        movimiento: [movimiento({ concepto: "COMPRA AMAZON EU SARL" })],
      }),
    )
    const res = await mod.conciliarLote(
      admin,
      {
        items: [{ importe: 42.5, fecha: "2026-03-10", proveedor: "Mercadona", factura_id: "fac-1" }],
        aplicar: true,
      },
      ACTOR,
    )
    expect(res.resultados[0].candidatos[0].otro_proveedor_en_concepto).toBe(true)
    expect(res.resultados[0].match_directo).toBe(false)
    expect(res.vinculados).toBe(0)
    expect(admin.tablas.movimiento[0].factura_id).toBeNull()
  })

  it("con dos candidatos igual de buenos no se decide solo", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [factura()],
        movimiento: [
          movimiento({ id: "mov-1" }),
          movimiento({ id: "mov-2", concepto: "OTRA COMPRA TARJETA" }),
        ],
      }),
    )
    const res = await mod.conciliarLote(
      admin,
      { items: [{ importe: 42.5, fecha: "2026-03-10", factura_id: "fac-1" }], aplicar: true },
      ACTOR,
    )
    expect(res.resultados[0].match_directo).toBe(false)
    expect(res.vinculados).toBe(0)
  })

  it("sin factura_id y sin permiso para crearla, avisa de qué hacer", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.conciliarLote(
      admin,
      { items: [{ importe: 42.5, fecha: "2026-03-10" }], aplicar: true },
      ACTOR,
    )
    expect(res.vinculados).toBe(0)
    expect(res.resultados[0].aviso).toContain("crear_facturas")
  })

  it("con crear_facturas registra la factura en la bandeja y la vincula", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.conciliarLote(
      admin,
      {
        items: [{ importe: 42.5, fecha: "2026-03-10", numero: "F-2026-9" }],
        aplicar: true,
        crearFacturas: true,
      },
      ACTOR,
    )
    expect(res.vinculados).toBe(1)
    expect(admin.tablas.factura).toHaveLength(1)
    expect(admin.tablas.factura[0]).toMatchObject({
      numero: "F-2026-9",
      estado: "bandeja",
      importe: 42.5,
      delegacion_id: SEV.id,
    })
  })

  it("los movimientos que ya tienen factura no se ofrecen como candidatos", async () => {
    const { mod, admin } = await api(
      tablas({ movimiento: [movimiento({ factura_id: "fac-otra" })] }),
    )
    const res = await mod.conciliarLote(admin, { items: [{ importe: 42.5 }] }, ACTOR)
    expect(res.resultados[0].candidatos).toHaveLength(0)
  })

  it("los movimientos ignorados tampoco", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento({ ignorado: true })] }))
    const res = await mod.conciliarLote(admin, { items: [{ importe: 42.5 }] }, ACTOR)
    expect(res.resultados[0].candidatos).toHaveLength(0)
  })

  it("un fallo al vincular una línea no tumba el lote entero", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [factura({ delegacion_id: MAD.id })],
        movimiento: [movimiento()],
      }),
    )
    const res = await mod.conciliarLote(
      admin,
      { items: [{ importe: 42.5, fecha: "2026-03-10", factura_id: "fac-1" }], aplicar: true },
      ACTOR,
    )
    expect(res.total).toBe(1)
    expect(res.vinculados).toBe(0)
    expect(res.resultados[0].aviso).toContain("No se pudo vincular")
  })
})
