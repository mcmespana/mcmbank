import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Lectura de facturas con IA. La regla que sostiene el módulo —"la IA
 * sugiere, no decide"— se rompe si: se pisa un campo que ya tenía la
 * factura, se vincula un proveedor por parecido en vez de coincidencia
 * exacta, se acepta una categoría que el modelo no tenía en la lista dada, o
 * un fallo del modelo hace fallar a quien llama en vez de guardarse como
 * `datos_ia.error`. Eso es lo que se prueba aquí; el resto (parseo de
 * fechas/importes) ya lo cubre `facturas-ia.test.ts`.
 */

vi.mock("@/lib/api/gemini", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api/gemini")>()
  return { ...real, geminiConfigurado: vi.fn(), generarJson: vi.fn() }
})

// Import estático: el mock de `vi.mock` es el mismo objeto durante todo el
// fichero (`vi.resetModules()` no lo recrea), así que se reinicia a mano en
// cada test en vez de fiarse de que quede "true" por defecto.
import { geminiConfigurado } from "@/lib/api/gemini"

const SEV_ID = "aaaaaaaa-0000-0000-0000-000000000001"
const ACTOR = "actor-1"
const CAT_LUZ = { id: "cat-luz", nombre: "Luz y agua", tipo: "gasto", es_global: true, delegacion_id: null, orden: 1, esta_activa: true }
const CAT_INGRESO = { id: "cat-ingreso", nombre: "Donativos", tipo: "ingreso", es_global: true, delegacion_id: null, orden: 2, esta_activa: true }

function facturaRow(over: Record<string, any> = {}) {
  return {
    id: "fac-1",
    delegacion_id: SEV_ID,
    numero: null,
    concepto: null,
    importe: null,
    moneda: "EUR",
    fecha_emision: null,
    contacto_id: null,
    categoria_id: null,
    notas: null,
    datos_ia: null,
    creado_en: "2026-03-01T00:00:00Z",
    actualizado_en: "2026-03-01T00:00:00Z",
    ...over,
  }
}

function adjuntoLegible(over: Record<string, any> = {}) {
  return {
    id: "adj-1",
    entidad: "factura",
    entidad_id: "fac-1",
    bucket: "facturas",
    path_storage: "sev/factura.pdf",
    tipo_mime: "application/pdf",
    tamano_bytes: 1000,
    subido_en: "2026-03-01T00:00:00Z",
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [{ id: SEV_ID, codigo: "SEV", nombre: "Sevilla" }],
    factura: [facturaRow()],
    archivo_adjunto: [],
    contacto: [],
    contacto_delegacion: [],
    categoria: [CAT_LUZ, CAT_INGRESO],
    movimiento: [],
    ...extra,
  }
}

function respuestaModelo(datos: Record<string, any> = {}) {
  return {
    datos: {
      es_factura: true,
      proveedor_nombre: "Iberdrola",
      proveedor_nif: "A12345678",
      importe_total: 45.6,
      concepto: "luz de marzo",
      categoria: "Luz y agua",
      confianza: 0.9,
      ...datos,
    },
    modelo: "gemini-3.7-flash",
    tokensEntrada: 100,
    tokensSalida: 50,
  }
}

beforeEach(() => {
  vi.resetModules()
  // `vi.mock(...)` no se recrea con `resetModules()`: es el mismo objeto en
  // todo el fichero. `clearAllMocks()` no basta porque no borra las
  // implementaciones puestas con `mockReturnValue`/`mockResolvedValue` de un
  // test anterior; hay que resetearlas y devolver el valor por defecto.
  vi.resetAllMocks()
  vi.mocked(geminiConfigurado).mockReturnValue(true)
})

async function api(t: Tablas = tablas()) {
  const mod = await import("@/lib/api/factura-ia")
  const gemini = await import("@/lib/api/gemini")
  const admin = crearFakeAdmin(t) as any
  return { mod, admin, gemini: gemini as any }
}

// ---------------------------------------------------------------------------

describe("extraerDatosFactura · casos previos al modelo", () => {
  it("una factura inexistente da 404", async () => {
    const { mod, admin } = await api(tablas({ factura: [] }))
    await expect(mod.extraerDatosFactura(admin, "fac-x")).rejects.toMatchObject({ status: 404 })
  })

  it("si ya hay una lectura 'listo' y no se pide forzar, no llama al modelo", async () => {
    const previos = { version: 1, estado: "listo", modelo: "x", extraido_en: "2026-01-01", confianza: null, es_factura: true, sugerencias: null, campos_rellenados: [], categoria_aceptada: null, error: null, uso: null }
    const { mod, admin, gemini } = await api(tablas({ factura: [facturaRow({ datos_ia: previos })] }))
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.estado).toBe("listo")
    expect(gemini.generarJson).not.toHaveBeenCalled()
  })

  it("con forzar:true, vuelve a leer aunque ya estuviera listo", async () => {
    const previos = { version: 1, estado: "listo", modelo: "x", extraido_en: "2026-01-01", confianza: null, es_factura: true, sugerencias: null, campos_rellenados: [], categoria_aceptada: null, error: null, uso: null }
    const { mod, admin, gemini } = await api(
      tablas({ factura: [facturaRow({ datos_ia: previos })], archivo_adjunto: [adjuntoLegible()] }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())
    await mod.extraerDatosFactura(admin, "fac-1", { forzar: true })
    expect(gemini.generarJson).toHaveBeenCalledTimes(1)
  })

  it("sin GEMINI_API_KEY configurada, guarda el error sin llamar al modelo", async () => {
    const { mod, admin, gemini } = await api()
    vi.mocked(gemini.geminiConfigurado).mockReturnValue(false)
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.estado).toBe("error")
    expect(res.datos.error).toContain("GEMINI_API_KEY")
    expect(gemini.generarJson).not.toHaveBeenCalled()
  })

  it("sin ningún adjunto legible ni texto de respaldo, estado 'sin_documento'", async () => {
    const { mod, admin } = await api(tablas({ factura: [facturaRow({ notas: null, concepto: null })] }))
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.estado).toBe("sin_documento")
  })

  it("sin adjunto pero con suficiente texto en notas, sí lee (como contexto de texto)", async () => {
    const { mod, admin, gemini } = await api(
      tablas({ factura: [facturaRow({ notas: "Correo reenviado con el detalle completo del pedido de luz de marzo, importe cuarenta y cinco con sesenta euros" })] }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.estado).toBe("listo")
    const llamada = vi.mocked(gemini.generarJson).mock.calls[0][0] as any
    expect(llamada.documento).toBeNull()
  })
})

describe("extraerDatosFactura · rellena solo los huecos", () => {
  it("rellena importe, fecha y proveedor vacíos, pero no toca lo que ya había", async () => {
    const { mod, admin, gemini } = await api(
      tablas({
        factura: [facturaRow({ concepto: "Concepto ya puesto a mano", archivo_adjunto: undefined })],
        archivo_adjunto: [adjuntoLegible()],
      }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo({ fecha_emision: "2026-03-05" }))

    const res = await mod.extraerDatosFactura(admin, "fac-1")

    expect(admin.tablas.factura[0].importe).toBe(45.6)
    expect(admin.tablas.factura[0].fecha_emision).toBe("2026-03-05")
    // El concepto no se pisa: ya había uno que no parece nombre de archivo.
    expect(admin.tablas.factura[0].concepto).toBe("Concepto ya puesto a mano")
    expect(res.datos.campos_rellenados).toEqual(expect.arrayContaining(["importe", "fecha_emision", "contacto_id"]))
    expect(res.datos.campos_rellenados).not.toContain("concepto")
  })

  it("sí sustituye un concepto que es solo el nombre de archivo que puso la bandeja", async () => {
    const { mod, admin, gemini } = await api(
      tablas({ factura: [facturaRow({ concepto: "factura-2026-03-12" })], archivo_adjunto: [adjuntoLegible()] }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())
    await mod.extraerDatosFactura(admin, "fac-1")
    expect(admin.tablas.factura[0].concepto).toBe("luz de marzo")
  })
})

describe("extraerDatosFactura · proveedor: solo coincidencia exacta", () => {
  it("un NIF que ya existe en el catálogo se vincula, no se crea otro", async () => {
    const proveedorExistente = { id: "con-1", nombre: "Iberdrola Clientes SAU", identificador_fiscal: "A12345678", es_global: true, archivado: false, tipo: "proveedor" }
    const { mod, admin, gemini } = await api(
      tablas({ contacto: [proveedorExistente], archivo_adjunto: [adjuntoLegible()] }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())

    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.proveedor).toMatchObject({ contacto_id: "con-1", creado: false })
    expect(admin.tablas.contacto).toHaveLength(1) // no se ha creado ninguno nuevo
  })

  it("sin coincidencia exacta, crea un proveedor global nuevo", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())

    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.proveedor?.creado).toBe(true)
    const creado = admin.tablas.contacto.find((c: any) => c.nombre === "Iberdrola")
    expect(creado).toBeDefined()
    expect(creado.es_global).toBe(true)
    expect(creado.delegacion_id).toBeNull()
  })

  it("no crea proveedor si el documento no parece una factura", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo({ es_factura: false }))
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.proveedor?.contacto_id).toBeNull()
    expect(admin.tablas.contacto).toHaveLength(0)
  })

  it("no crea proveedor si la factura ya tenía uno vinculado", async () => {
    const { mod, admin, gemini } = await api(
      tablas({ factura: [facturaRow({ contacto_id: "con-ya-puesto" })], archivo_adjunto: [adjuntoLegible()] }),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())
    await mod.extraerDatosFactura(admin, "fac-1")
    expect(admin.tablas.contacto).toHaveLength(0)
    // Y tampoco se pisa el contacto_id ya puesto.
    expect(admin.tablas.factura[0].contacto_id).toBe("con-ya-puesto")
  })

  it("si el alta choca con el índice único (proveedor creado a la vez por otra lectura), usa el existente", async () => {
    const { mod, admin, gemini } = await api(
      tablas({ archivo_adjunto: [adjuntoLegible()] }, ),
    )
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo())

    const original = admin.from.bind(admin)
    admin.from = (tabla: string) => {
      const builder = original(tabla)
      if (tabla !== "contacto") return builder
      const insertOriginal = builder.insert.bind(builder)
      builder.insert = (valores: any) => {
        const api = insertOriginal(valores)
        const singleOriginal = api.single.bind(api)
        api.single = () => {
          singleOriginal()
          return { then: (_res: any, rej: any) => Promise.reject({ message: "duplicate key value", code: "23505" }).catch(rej) }
        }
        return api
      }
      return builder
    }
    // Precondición: ya existe un proveedor global con esa misma clave normalizada.
    admin.tablas.contacto.push({ id: "con-preexistente", nombre: "Iberdrola", identificador_fiscal: null, es_global: true, clave_normalizada: "iberdrola", tipo: "proveedor" })

    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.proveedor?.contacto_id).toBe("con-preexistente")
  })
})

describe("extraerDatosFactura · categoría", () => {
  it("solo acepta una categoría de la lista que se le pasó al modelo, y no una de ingreso", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo({ categoria: "Donativos" }))
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    // "Donativos" es de tipo ingreso: no se le ofrece al modelo, así que aunque
    // la devuelva no hay match en la lista de categorías consideradas.
    expect(res.datos.sugerencias?.categoria).toBeNull()
  })

  it("NINGUNA se traduce en que no hay categoría sugerida", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo({ categoria: "NINGUNA" }))
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.categoria).toBeNull()
  })

  it("una categoría válida sí se sugiere, con su motivo", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(
      respuestaModelo({ categoria: "Luz y agua", categoria_motivo: "Es una factura eléctrica" }),
    )
    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.sugerencias?.categoria).toMatchObject({ id: CAT_LUZ.id, motivo: "Es una factura eléctrica" })
  })
})

describe("extraerDatosFactura · el modelo nunca decide, y nunca revienta la llamada", () => {
  it("si el modelo falla, se guarda datos_ia.error y no se lanza", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockRejectedValue(new Error("Gemini devolvió 503"))

    const res = await mod.extraerDatosFactura(admin, "fac-1")
    expect(res.datos.estado).toBe("error")
    expect(res.datos.error).toContain("Gemini devolvió 503")
    expect(admin.tablas.factura[0].importe).toBeNull() // no se ha tocado nada
  })

  it("la categoría nunca se escribe en la factura directamente, solo queda como sugerencia", async () => {
    const { mod, admin, gemini } = await api(tablas({ archivo_adjunto: [adjuntoLegible()] }))
    vi.mocked(gemini.generarJson).mockResolvedValue(respuestaModelo({ categoria: "Luz y agua" }))
    await mod.extraerDatosFactura(admin, "fac-1")
    expect(admin.tablas.factura[0].categoria_id).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe("aceptarCategoriaSugerida", () => {
  const DATOS_CON_SUGERENCIA = {
    version: 1,
    estado: "listo",
    modelo: "x",
    extraido_en: "2026-01-01",
    confianza: null,
    es_factura: true,
    sugerencias: { numero: null, fecha_emision: null, importe: null, moneda: "EUR", concepto: null, proveedor: null, categoria: { id: CAT_LUZ.id, nombre: CAT_LUZ.nombre, motivo: null } },
    campos_rellenados: [],
    categoria_aceptada: null,
    error: null,
    uso: null,
  }

  it("una factura inexistente da 404", async () => {
    const { mod, admin } = await api(tablas({ factura: [] }))
    await expect(mod.aceptarCategoriaSugerida(admin, "fac-x")).rejects.toMatchObject({ status: 404 })
  })

  it("sin categoriaId indicado y sin sugerencia de la IA, pide indicar una", async () => {
    const { mod, admin } = await api()
    await expect(mod.aceptarCategoriaSugerida(admin, "fac-1")).rejects.toThrow("No hay ninguna categoría")
  })

  it("usa la categoría sugerida por la IA si no se indica ninguna", async () => {
    const { mod, admin } = await api(tablas({ factura: [facturaRow({ datos_ia: DATOS_CON_SUGERENCIA })] }))
    await mod.aceptarCategoriaSugerida(admin, "fac-1", { actorId: ACTOR })
    expect(admin.tablas.factura[0].categoria_id).toBe(CAT_LUZ.id)
  })

  it("una categoría que no existe en la delegación se rechaza con las válidas", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.aceptarCategoriaSugerida(admin, "fac-1", { categoriaId: "cat-inventada" }),
    ).rejects.toMatchObject({ status: 400, detalles: { categorias_validas: expect.any(Array) } })
  })

  it("propaga la categoría a los movimientos vinculados que no tenían, sin pisar los que ya la tenían", async () => {
    const { mod, admin } = await api(
      tablas({
        factura: [facturaRow({ datos_ia: DATOS_CON_SUGERENCIA })],
        movimiento: [
          { id: "m1", factura_id: "fac-1", categoria_id: null },
          { id: "m2", factura_id: "fac-1", categoria_id: "cat-ya-puesta" },
        ],
      }),
    )
    await mod.aceptarCategoriaSugerida(admin, "fac-1")
    expect(admin.tablas.movimiento.find((m: any) => m.id === "m1").categoria_id).toBe(CAT_LUZ.id)
    expect(admin.tablas.movimiento.find((m: any) => m.id === "m2").categoria_id).toBe("cat-ya-puesta")
  })

  it("registra quién y cuándo la aceptó dentro de datos_ia", async () => {
    const { mod, admin } = await api(tablas({ factura: [facturaRow({ datos_ia: DATOS_CON_SUGERENCIA })] }))
    await mod.aceptarCategoriaSugerida(admin, "fac-1", { actorId: ACTOR })
    expect(admin.tablas.factura[0].datos_ia.categoria_aceptada).toMatchObject({ por: ACTOR })
  })
})
