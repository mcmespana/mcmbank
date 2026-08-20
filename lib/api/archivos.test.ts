import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Subida, vinculación y borrado de archivos (facturas y documentos) desde la
 * API externa. Lo que importa comprobar no es Storage en sí (eso no se
 * puede probar sin red), sino las reglas alrededor: qué tipos y tamaños se
 * aceptan, que subir una factura a un movimiento cree (o reutilice) la
 * entidad `factura` al otro lado, que un nombre repetido no sobrescriba el
 * archivo anterior, y que un fallo al registrar la factura no se lleve por
 * delante el adjunto ya subido.
 *
 * Storage se simula aparte del `fake-admin` general (que solo sabe subir sin
 * fallar nunca): aquí interesa que subir dos veces el mismo `path` falle como
 * lo haría Supabase, para probar el reintento con sufijo.
 */

const SEV = { id: "aaaaaaaa-0000-0000-0000-000000000001", codigo: "SEV", nombre: "Sevilla" }
const ACTOR = "11111111-1111-1111-1111-111111111111"

const PDF_BASE64 = Buffer.from("contenido de prueba").toString("base64")

function archivoPdf(over: Record<string, any> = {}) {
  return { nombre: "factura.pdf", contenido_base64: PDF_BASE64, ...over }
}

function movimiento(over: Record<string, any> = {}) {
  return {
    id: "mov-1",
    delegacion_id: SEV.id,
    fecha: "2026-03-10",
    concepto: "Compra material",
    importe: -42.5,
    contacto_id: null,
    factura_id: null,
    ...over,
  }
}

function factura(over: Record<string, any> = {}) {
  return { id: "fac-1", delegacion_id: SEV.id, ...over }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    delegacion: [SEV],
    movimiento: [],
    movimiento_archivo: [],
    factura: [],
    archivo_adjunto: [],
    ...extra,
  }
}

function storageDeMentira() {
  const ocupados: Record<string, Set<string>> = {}
  const subidas: { bucket: string; path: string; contentType?: string }[] = []
  const borrados: { bucket: string; path: string }[] = []
  return {
    subidas,
    borrados,
    from(bucket: string) {
      const rutas = (ocupados[bucket] ??= new Set())
      return {
        upload: async (path: string, _buffer: Buffer, opts?: { contentType?: string }) => {
          if (rutas.has(path)) return { data: null, error: { message: "The resource already exists" } }
          rutas.add(path)
          subidas.push({ bucket, path, contentType: opts?.contentType })
          return { data: { path }, error: null }
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/${bucket}/${path}?firma=1` },
          error: null,
        }),
        remove: async (paths: string[]) => {
          borrados.push(...paths.map((path) => ({ bucket, path })))
          return { data: null, error: null }
        },
      }
    },
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function api(t: Tablas = tablas()) {
  const mod = await import("@/lib/api/archivos")
  const admin = crearFakeAdmin(t) as any
  admin.storage = storageDeMentira()
  return { mod, admin }
}

// ---------------------------------------------------------------------------

describe("subirArchivoAMovimiento · validación del archivo", () => {
  it("rechaza sin nombre", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, { movimientoId: "mov-1", archivo: archivoPdf({ nombre: "" }), actorId: ACTOR }),
    ).rejects.toThrow("nombre del archivo")
  })

  it("rechaza un bucket que no existe", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, {
        movimientoId: "mov-1",
        archivo: archivoPdf({ bucket: "privado" }),
        actorId: ACTOR,
      }),
    ).rejects.toThrow("Bucket")
  })

  it("sin extensión ni tipo_mime, no sabe qué es", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, {
        movimientoId: "mov-1",
        archivo: archivoPdf({ nombre: "factura-sin-extension" }),
        actorId: ACTOR,
      }),
    ).rejects.toThrow("No sé qué tipo de archivo es")
  })

  it("rechaza un tipo no permitido en ese bucket (un .exe en facturas)", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, {
        movimientoId: "mov-1",
        archivo: archivoPdf({ nombre: "programa.exe", tipo_mime: "application/x-msdownload" }),
        actorId: ACTOR,
      }),
    ).rejects.toMatchObject({ status: 400, detalles: { permitidos: expect.any(Array) } })
  })

  it("acepta una data URL además de base64 a secas", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.subirArchivoAMovimiento(admin, {
      movimientoId: "mov-1",
      archivo: archivoPdf({ contenido_base64: `data:application/pdf;base64,${PDF_BASE64}` }),
      actorId: ACTOR,
    })
    expect(res.archivo.tipo_mime).toBe("application/pdf")
  })

  it("un base64 vacío o inválido se rechaza", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, {
        movimientoId: "mov-1",
        archivo: archivoPdf({ contenido_base64: "" }),
        actorId: ACTOR,
      }),
    ).rejects.toThrow("vacío")
  })

  it("un archivo demasiado grande para la API sugiere subirlo desde la app", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const grande = Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64")
    await expect(
      mod.subirArchivoAMovimiento(admin, {
        movimientoId: "mov-1",
        archivo: archivoPdf({ contenido_base64: grande }),
        actorId: ACTOR,
      }),
    ).rejects.toThrow("Súbelo desde la aplicación")
  })
})

describe("subirArchivoAMovimiento · movimiento", () => {
  it("un movimiento inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.subirArchivoAMovimiento(admin, { movimientoId: "mov-x", archivo: archivoPdf(), actorId: ACTOR }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it("un movimiento sin delegación no sabe dónde guardar el archivo", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento({ delegacion_id: null })] }))
    await expect(
      mod.subirArchivoAMovimiento(admin, { movimientoId: "mov-1", archivo: archivoPdf(), actorId: ACTOR }),
    ).rejects.toThrow("no tiene delegación")
  })
})

describe("subirArchivoAMovimiento · sube y crea la factura al otro lado", () => {
  it("registra el adjunto y crea la factura vinculada por defecto", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.subirArchivoAMovimiento(admin, {
      movimientoId: "mov-1",
      archivo: archivoPdf(),
      actorId: ACTOR,
    })

    expect(res.archivo.nombre_original).toBe("factura.pdf")
    expect(admin.tablas.movimiento_archivo).toHaveLength(1)
    expect(admin.tablas.movimiento_archivo[0]).toMatchObject({
      movimiento_id: "mov-1",
      subido_por: ACTOR,
      es_factura: true,
    })

    expect(res.factura_id).toBeTruthy()
    expect(admin.tablas.factura).toHaveLength(1)
    expect(admin.tablas.factura[0]).toMatchObject({
      delegacion_id: SEV.id,
      importe: 42.5, // siempre en positivo, aunque el movimiento sea un gasto
      creado_por: ACTOR,
    })
  })

  it("con crearFactura: false, solo sube el adjunto", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    const res = await mod.subirArchivoAMovimiento(admin, {
      movimientoId: "mov-1",
      archivo: archivoPdf(),
      actorId: ACTOR,
      crearFactura: false,
    })
    expect(res.factura_id).toBeNull()
    expect(admin.tablas.factura).toHaveLength(0)
  })

  it("en el bucket 'documentos' no se crea factura aunque no se pida lo contrario", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await mod.subirArchivoAMovimiento(admin, {
      movimientoId: "mov-1",
      archivo: archivoPdf({ bucket: "documentos", nombre: "contrato.pdf" }),
      actorId: ACTOR,
    })
    expect(admin.tablas.factura).toHaveLength(0)
    expect(admin.tablas.movimiento_archivo[0].es_factura).toBe(false)
  })

  it("si falla el registro en Facturas, el adjunto ya subido no se pierde", async () => {
    const t = tablas({ movimiento: [movimiento()] })
    const mod = await import("@/lib/api/archivos")
    const admin = crearFakeAdmin(t, { errores: { factura: { message: "fallo simulado de Postgres" } } }) as any
    admin.storage = storageDeMentira()

    const res = await mod.subirArchivoAMovimiento(admin, {
      movimientoId: "mov-1",
      archivo: archivoPdf(),
      actorId: ACTOR,
    })

    expect(admin.tablas.movimiento_archivo).toHaveLength(1)
    expect(res.aviso).toContain("no se pudo registrar en la sección Facturas")
    expect(res.factura_id).toBeNull()
  })

  it("subir dos archivos con el mismo nombre al mismo movimiento no sobrescribe: añade un sufijo", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento()] }))
    await mod.subirArchivoAMovimiento(admin, { movimientoId: "mov-1", archivo: archivoPdf(), actorId: ACTOR })
    await mod.subirArchivoAMovimiento(admin, { movimientoId: "mov-1", archivo: archivoPdf(), actorId: ACTOR })

    expect(admin.tablas.movimiento_archivo).toHaveLength(2)
    const nombres = admin.tablas.movimiento_archivo.map((f: any) => f.nombre_archivo).sort()
    expect(nombres[0]).toBe("factura-2.pdf")
    expect(nombres[1]).toBe("factura.pdf")
  })
})

// ---------------------------------------------------------------------------

describe("subirArchivoAFactura", () => {
  it("una factura inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(
      mod.subirArchivoAFactura(admin, { facturaId: "fac-x", archivo: archivoPdf(), actorId: ACTOR }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it("registra el adjunto en archivo_adjunto", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    const res = await mod.subirArchivoAFactura(admin, {
      facturaId: "fac-1",
      archivo: archivoPdf(),
      actorId: ACTOR,
    })
    expect(res.factura_id).toBe("fac-1")
    expect(admin.tablas.archivo_adjunto).toHaveLength(1)
    expect(admin.tablas.archivo_adjunto[0]).toMatchObject({
      entidad: "factura",
      entidad_id: "fac-1",
      delegacion_id: SEV.id,
    })
  })

  it("replica el adjunto en los movimientos ya conciliados con esa factura", async () => {
    const { mod, admin } = await api(
      tablas({ factura: [factura()], movimiento: [movimiento({ factura_id: "fac-1" })] }),
    )
    await mod.subirArchivoAFactura(admin, { facturaId: "fac-1", archivo: archivoPdf(), actorId: ACTOR })
    expect(admin.tablas.movimiento_archivo).toHaveLength(1)
    expect(admin.tablas.movimiento_archivo[0].movimiento_id).toBe("mov-1")
  })

  it("con un límite de tamaño propio (buzón de correo), el mensaje no manda a subirlo desde la app", async () => {
    const { mod, admin } = await api(tablas({ factura: [factura()] }))
    const grande = Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64")
    await expect(
      mod.subirArchivoAFactura(admin, {
        facturaId: "fac-1",
        archivo: archivoPdf({ contenido_base64: grande }),
        actorId: ACTOR,
        limiteBytes: 10 * 1024 * 1024,
      }),
    ).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------

describe("asegurarFacturaDeMovimiento", () => {
  it("crea una factura copiando fecha, importe (en positivo) y contacto", async () => {
    const { mod, admin } = await api(
      tablas({ movimiento: [movimiento({ importe: -99.9, contacto_id: "con-1" })] }),
    )
    const factura = await mod.asegurarFacturaDeMovimiento(admin, "mov-1", ACTOR)
    expect(admin.tablas.factura[0]).toMatchObject({
      id: factura.id,
      importe: 99.9,
      contacto_id: "con-1",
      origen: "movimiento",
    })
    expect(admin.tablas.movimiento[0].factura_id).toBe(factura.id)
  })

  it("si el movimiento ya tiene una factura viva, la reutiliza en vez de duplicar", async () => {
    const { mod, admin } = await api(
      tablas({ movimiento: [movimiento({ factura_id: "fac-1" })], factura: [factura()] }),
    )
    const resultado = await mod.asegurarFacturaDeMovimiento(admin, "mov-1", ACTOR)
    expect(resultado.id).toBe("fac-1")
    expect(admin.tablas.factura).toHaveLength(1)
  })

  it("si la factura referenciada ya no existe, crea una nueva en vez de fallar", async () => {
    const { mod, admin } = await api(tablas({ movimiento: [movimiento({ factura_id: "fac-borrada" })] }))
    const resultado = await mod.asegurarFacturaDeMovimiento(admin, "mov-1", ACTOR)
    expect(resultado.id).not.toBe("fac-borrada")
    expect(admin.tablas.factura).toHaveLength(1)
  })

  it("un movimiento inexistente da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.asegurarFacturaDeMovimiento(admin, "mov-x", ACTOR)).rejects.toMatchObject({ status: 404 })
  })
})

// ---------------------------------------------------------------------------

describe("localizarArchivo / urlFirmada / eliminarArchivo", () => {
  it("localiza un archivo en movimiento_archivo", async () => {
    const { mod, admin } = await api(
      tablas({ movimiento_archivo: [{ id: "arc-1", bucket: "facturas", path_storage: "x" }] }),
    )
    const encontrado = await mod.localizarArchivo(admin, "arc-1")
    expect(encontrado.origen).toBe("movimiento")
  })

  it("localiza un archivo en archivo_adjunto si no está en movimiento_archivo", async () => {
    const { mod, admin } = await api(
      tablas({ archivo_adjunto: [{ id: "arc-1", bucket: "facturas", path_storage: "x" }] }),
    )
    const encontrado = await mod.localizarArchivo(admin, "arc-1")
    expect(encontrado.origen).toBe("factura")
  })

  it("un id que no está en ninguna de las dos tablas da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.localizarArchivo(admin, "arc-x")).rejects.toMatchObject({ status: 404 })
  })

  it("urlFirmada devuelve la url firmada de Storage", async () => {
    const { mod, admin } = await api()
    const url = await mod.urlFirmada(admin, "facturas", "sev/2026/mar/mov-1/factura.pdf")
    expect(url).toContain("firma=1")
  })

  it("si Storage no puede firmar, se traduce en un 502", async () => {
    const { mod, admin } = await api()
    admin.storage.from = () => ({
      createSignedUrl: async () => ({ data: null, error: { message: "not found" } }),
    })
    await expect(mod.urlFirmada(admin, "facturas", "no-existe.pdf")).rejects.toMatchObject({ status: 502 })
  })

  it("borra el registro aunque Storage falle al borrar el fichero", async () => {
    const { mod, admin } = await api(
      tablas({ movimiento_archivo: [{ id: "arc-1", bucket: "facturas", path_storage: "x" }] }),
    )
    admin.storage.from = () => ({ remove: async () => ({ data: null, error: { message: "ya no está" } }) })

    await mod.eliminarArchivo(admin, "arc-1")
    expect(admin.tablas.movimiento_archivo).toHaveLength(0)
  })

  it("un id inexistente al borrar da 404", async () => {
    const { mod, admin } = await api()
    await expect(mod.eliminarArchivo(admin, "arc-x")).rejects.toMatchObject({ status: 404 })
  })
})

// ---------------------------------------------------------------------------

describe("listarArchivosFactura / archivosDeFacturas", () => {
  it("lista los archivos de una factura", async () => {
    const { mod, admin } = await api(
      tablas({
        archivo_adjunto: [
          { id: "a1", entidad: "factura", entidad_id: "fac-1", bucket: "facturas", subido_en: "2026-01-01" },
        ],
      }),
    )
    const lista = await mod.listarArchivosFactura(admin, "fac-1")
    expect(lista).toHaveLength(1)
  })

  it("agrupa los archivos de varias facturas por su id", async () => {
    const { mod, admin } = await api(
      tablas({
        archivo_adjunto: [
          { id: "a1", entidad: "factura", entidad_id: "fac-1", bucket: "facturas", subido_en: "2026-01-01" },
          { id: "a2", entidad: "factura", entidad_id: "fac-2", bucket: "facturas", subido_en: "2026-01-01" },
        ],
      }),
    )
    const agrupados = await mod.archivosDeFacturas(admin, ["fac-1", "fac-2", "fac-3"])
    expect(agrupados.get("fac-1")).toHaveLength(1)
    expect(agrupados.get("fac-2")).toHaveLength(1)
    expect(agrupados.has("fac-3")).toBe(false)
  })

  it("una lista vacía de ids no consulta nada y devuelve un mapa vacío", async () => {
    const { mod, admin } = await api()
    const agrupados = await mod.archivosDeFacturas(admin, [])
    expect(agrupados.size).toBe(0)
    expect(admin.consultas).toHaveLength(0)
  })
})
