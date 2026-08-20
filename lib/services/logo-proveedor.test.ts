import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"
import {
  identificarImagen,
  pathDesdeUrlPublica,
  descargarLogo,
  borrarLogoDeStorage,
  subirLogo,
  guardarLogoManual,
  resolverLogoProveedor,
} from "@/lib/services/logo-proveedor"

/**
 * Logo de un proveedor: se descarga una vez de una de cuatro fuentes
 * externas y se guarda en nuestro bucket. Lo que hay que vigilar es lo que
 * pasa cuando la fuente miente: un dominio prohibido (red interna) nunca
 * debe consultarse, un "logo" que en realidad es una página de error HTML
 * con cabecera de imagen se descarta por su firma de bytes (no por el
 * Content-Type, que no es de fiar), y un logo puesto a mano por una persona
 * queda blindado frente a la búsqueda automática.
 */

let fakeAdmin: ReturnType<typeof crearFakeAdmin>

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeAdmin,
}))

function storageDeMentira() {
  const subidas: any[] = []
  const borrados: string[][] = []
  return {
    subidas,
    borrados,
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array, opts: any) => {
        subidas.push({ bucket, path, opts })
        return { data: { path }, error: null }
      },
      remove: async (paths: string[]) => {
        borrados.push(paths)
        return { data: null, error: null }
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://storage.test/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  }
}

let storage: ReturnType<typeof storageDeMentira>

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { contacto: [], ...extra }
}

beforeEach(() => {
  storage = storageDeMentira()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function admin(t: Tablas = tablas()) {
  fakeAdmin = crearFakeAdmin(t) as any
  fakeAdmin.storage = storage
  return fakeAdmin
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const SVG = new TextEncoder().encode("<svg xmlns='...'></svg>")
const HTML_ERROR = new TextEncoder().encode("<!doctype html><html>404 not found</html>")

// ---------------------------------------------------------------------------

describe("identificarImagen", () => {
  it("reconoce PNG, JPEG y SVG por su firma, no por la extensión", () => {
    expect(identificarImagen(PNG)?.tipo).toBe("image/png")
    expect(identificarImagen(JPEG)?.tipo).toBe("image/jpeg")
    expect(identificarImagen(SVG)?.tipo).toBe("image/svg+xml")
  })

  it("una página de error HTML no se confunde con una imagen", () => {
    expect(identificarImagen(HTML_ERROR)).toBeNull()
  })

  it("un buffer demasiado corto para tener firma no revienta", () => {
    expect(identificarImagen(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe("pathDesdeUrlPublica", () => {
  it("extrae el path dentro del bucket", () => {
    expect(
      pathDesdeUrlPublica("https://x.supabase.co/storage/v1/object/public/logos/proveedores/abc-123.png"),
    ).toBe("proveedores/abc-123.png")
  })

  it("quita la query string y decodifica caracteres escapados", () => {
    expect(
      pathDesdeUrlPublica(
        "https://x.supabase.co/storage/v1/object/public/logos/proveedores/mi%20logo.png?t=123",
      ),
    ).toBe("proveedores/mi logo.png")
  })

  it("una url que no es de ese bucket devuelve null", () => {
    expect(pathDesdeUrlPublica("https://otra-cosa.example/x.png")).toBeNull()
  })

  it("sin url, devuelve null", () => {
    expect(pathDesdeUrlPublica(null)).toBeNull()
    expect(pathDesdeUrlPublica(undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe("descargarLogo · seguridad y validación", () => {
  it("nunca consulta un host de la red interna", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const resultado = await descargarLogo(["metadata.internal", "169.254.169.254.local"])
    expect(resultado).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("descarta un 'logo' que es en realidad una página de error HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => HTML_ERROR.buffer,
      }),
    )
    expect(await descargarLogo(["proveedor.example"])).toBeNull()
  })

  it("descarta una imagen demasiado pequeña (1x1 de seguimiento)", async () => {
    const minuscula = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => minuscula.buffer }))
    expect(await descargarLogo(["proveedor.example"])).toBeNull()
  })

  it("una respuesta que no es 200 pasa a la siguiente fuente", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true, arrayBuffer: async () => grande(PNG) })
    vi.stubGlobal("fetch", fetchMock)
    const resultado = await descargarLogo(["proveedor.example"])
    expect(resultado?.tipoMime).toBe("image/png")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("si una fuente lanza (timeout, DNS roto), prueba la siguiente sin romper", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => grande(PNG),
    })
    vi.stubGlobal("fetch", fetchMock)
    const resultado = await descargarLogo(["proveedor.example"])
    expect(resultado).not.toBeNull()
  })

  it("encuentra el logo en el segundo dominio si el primero no da nada", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("bueno.example")) return { ok: true, arrayBuffer: async () => grande(PNG) }
      return { ok: false }
    })
    vi.stubGlobal("fetch", fetchMock)
    const resultado = await descargarLogo(["malo.example", "bueno.example"])
    expect(resultado?.dominio).toBe("bueno.example")
  })

  it("sin ningún candidato válido, devuelve null (no lanza)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await descargarLogo(["nada.example"])).toBeNull()
  })
})

function grande(firma: Uint8Array): ArrayBuffer {
  const buf = new Uint8Array(500)
  buf.set(firma)
  return buf.buffer
}

// ---------------------------------------------------------------------------

describe("subirLogo / borrarLogoDeStorage", () => {
  it("sube el archivo y devuelve la url pública", async () => {
    admin()
    const url = await subirLogo("con-1", { bytes: PNG, tipoMime: "image/png", extension: "png" })
    expect(url).toContain("/logos/proveedores/con-1-")
    expect(storage.subidas[0].opts.contentType).toBe("image/png")
  })

  it("si Storage falla al subir, lanza con su mensaje", async () => {
    admin()
    storage.from = (() => ({
      upload: async () => ({ data: null, error: { message: "bucket lleno" } }),
      remove: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    })) as any
    await expect(subirLogo("con-1", { bytes: PNG, tipoMime: "image/png", extension: "png" })).rejects.toThrow(
      "bucket lleno",
    )
  })

  it("borrarLogoDeStorage no hace nada si la url no es de nuestro bucket", async () => {
    admin()
    await borrarLogoDeStorage("https://otro-sitio.example/logo.png")
    expect(storage.borrados).toHaveLength(0)
  })

  it("borrarLogoDeStorage borra el path correcto", async () => {
    admin()
    await borrarLogoDeStorage("https://x.test/storage/v1/object/public/logos/proveedores/con-1-999.png")
    expect(storage.borrados).toEqual([["proveedores/con-1-999.png"]])
  })
})

// ---------------------------------------------------------------------------

describe("guardarLogoManual", () => {
  it("rechaza un archivo demasiado grande", async () => {
    const grande = new Uint8Array(1024 * 1024 + 1)
    admin(tablas({ contacto: [{ id: "con-1", logo_url: null }] }))
    await expect(guardarLogoManual("con-1", grande)).rejects.toThrow("1 MB")
  })

  it("rechaza algo que no es una imagen reconocible", async () => {
    admin(tablas({ contacto: [{ id: "con-1" }] }))
    await expect(guardarLogoManual("con-1", new TextEncoder().encode("no soy una imagen"))).rejects.toThrow(
      "no es una imagen",
    )
  })

  it("guarda el logo y lo marca como manual", async () => {
    admin(tablas({ contacto: [{ id: "con-1", logo_url: null }] }))
    const resultado = await guardarLogoManual("con-1", PNG)
    expect(resultado.fuente).toBe("manual")
    expect(fakeAdmin.tablas.contacto[0].logo_fuente).toBe("manual")
    expect(fakeAdmin.tablas.contacto[0].logo_url).toBe(resultado.logoUrl)
  })

  it("borra el logo anterior al reemplazarlo", async () => {
    admin(
      tablas({
        contacto: [{ id: "con-1", logo_url: "https://x.test/storage/v1/object/public/logos/viejo.png" }],
      }),
    )
    await guardarLogoManual("con-1", PNG)
    expect(storage.borrados).toEqual([["viejo.png"]])
  })
})

// ---------------------------------------------------------------------------

describe("resolverLogoProveedor", () => {
  it("un contacto inexistente lanza", async () => {
    admin()
    await expect(resolverLogoProveedor("con-x")).rejects.toThrow("no encontrado")
  })

  it("un logo puesto a mano no se toca sin forzar", async () => {
    admin(
      tablas({
        contacto: [{ id: "con-1", nombre: "Mercadona", dominio: "mercadona.es", logo_url: "https://x/logo.png", logo_fuente: "manual" }],
      }),
    )
    vi.stubGlobal("fetch", vi.fn())
    const resultado = await resolverLogoProveedor("con-1")
    expect(resultado).toEqual({
      encontrado: true,
      logoUrl: "https://x/logo.png",
      dominio: "mercadona.es",
      fuente: "manual",
      intentados: [],
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("con forzar:true, sí busca aunque el logo fuera manual", async () => {
    admin(
      tablas({
        contacto: [{ id: "con-1", nombre: "Mercadona", dominio: "mercadona.es", logo_url: "https://x/viejo.png", logo_fuente: "manual" }],
      }),
    )
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => grande(PNG) }))
    const resultado = await resolverLogoProveedor("con-1", { forzar: true })
    expect(resultado.fuente).toBe("unavatar")
    expect(fakeAdmin.tablas.contacto[0].logo_fuente).toBe("auto")
  })

  it("sin nada encontrado, devuelve los dominios que se intentaron", async () => {
    admin(tablas({ contacto: [{ id: "con-1", nombre: "Proveedor Inventado SL", dominio: null, logo_fuente: null }] }))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const resultado = await resolverLogoProveedor("con-1", { dominio: "proveedor-inventado.example" })
    expect(resultado.encontrado).toBe(false)
    expect(resultado.intentados).toContain("proveedor-inventado.example")
  })

  it("al encontrar un logo, actualiza la ficha y borra el anterior", async () => {
    admin(
      tablas({
        contacto: [
          {
            id: "con-1",
            nombre: "Iberdrola",
            dominio: null,
            logo_url: "https://x.test/storage/v1/object/public/logos/viejo.png",
            logo_fuente: null,
          },
        ],
      }),
    )
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => grande(PNG) }))

    const resultado = await resolverLogoProveedor("con-1", { dominio: "iberdrola.es" })

    expect(resultado.encontrado).toBe(true)
    expect(resultado.dominio).toBe("iberdrola.es")
    expect(fakeAdmin.tablas.contacto[0].logo_fuente).toBe("auto")
    expect(fakeAdmin.tablas.contacto[0].dominio).toBe("iberdrola.es")
    expect(storage.borrados).toEqual([["viejo.png"]])
  })
})
