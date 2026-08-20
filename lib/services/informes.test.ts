import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * Informes económicos por delegación: la ficha y sus archivos (subidos a
 * Storage o enlaces de Drive). Lo que importa: que borrar un informe
 * limpie primero sus archivos de Storage, que un fallo al registrar la
 * metadata deshaga la subida (para no dejar un fichero huérfano sin fila
 * que lo referencie), y que el nombre de archivo se sanee antes de formar
 * la ruta de Storage.
 */

let fakeAdmin: ReturnType<typeof crearFakeAdmin>
let usuarioActual: { id: string } | null = { id: "user-1" }

function storageDeMentira() {
  const subidas: { path: string; opts: any }[] = []
  const borrados: string[][] = []
  return {
    subidas,
    borrados,
    from: () => ({
      upload: async (path: string, _file: any, opts: any) => {
        subidas.push({ path, opts })
        return { data: { path }, error: null }
      },
      remove: async (paths: string[]) => {
        borrados.push(paths)
        return { data: null, error: null }
      },
      createSignedUrl: async (path: string, expiresIn: number) => ({
        data: { signedUrl: `https://firmada.test/${path}?ttl=${expiresIn}` },
        error: null,
      }),
    }),
  }
}

let storage: ReturnType<typeof storageDeMentira>

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (tabla: string) => fakeAdmin.from(tabla),
    auth: { getUser: async () => ({ data: { user: usuarioActual } }) },
    get storage() {
      return storage
    },
  },
}))

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return { informe: [], informe_archivo: [], ...extra }
}

function archivoFalso(over: Partial<{ name: string; type: string; size: number }> = {}) {
  return { name: "memoria.pdf", type: "application/pdf", size: 1234, ...over } as unknown as File
}

beforeEach(() => {
  vi.resetModules()
  usuarioActual = { id: "user-1" }
  storage = storageDeMentira()
})

async function servicio(t: Tablas = tablas()) {
  fakeAdmin = crearFakeAdmin(t)
  const { InformesService } = await import("@/lib/services/informes")
  return InformesService
}

describe("list", () => {
  it("filtra por delegación", async () => {
    const InformesService = await servicio(
      tablas({
        informe: [
          { id: "i1", delegacion_id: "del-1", anio: 2026 },
          { id: "i2", delegacion_id: "del-2", anio: 2026 },
        ],
      }),
    )
    const lista = await InformesService.list("del-1")
    expect(lista.map((i: any) => i.id)).toEqual(["i1"])
  })
})

describe("create", () => {
  it("firma la creación con el usuario actual", async () => {
    const InformesService = await servicio()
    const creado = await InformesService.create({ delegacion_id: "del-1", anio: 2026 } as any)
    expect(fakeAdmin.tablas.informe[0].creado_por).toBe("user-1")
    expect(creado.delegacion_id).toBe("del-1")
  })
})

describe("update", () => {
  it("aplica el patch a la fila existente", async () => {
    const InformesService = await servicio(tablas({ informe: [{ id: "i1", anio: 2025 }] }))
    await InformesService.update("i1", { anio: 2026 } as any)
    expect(fakeAdmin.tablas.informe[0].anio).toBe(2026)
  })
})

describe("remove", () => {
  it("borra primero los archivos de Storage y luego la fila", async () => {
    const InformesService = await servicio(tablas({ informe: [{ id: "i1" }] }))
    await InformesService.remove({
      id: "i1",
      archivos: [{ storage_path: "del-1/i1/x.pdf" }, { storage_path: null }],
    } as any)
    expect(storage.borrados).toEqual([["del-1/i1/x.pdf"]])
    expect(fakeAdmin.tablas.informe).toHaveLength(0)
  })

  it("sin archivos, no llama a Storage y borra igualmente la fila", async () => {
    const InformesService = await servicio(tablas({ informe: [{ id: "i1" }] }))
    await InformesService.remove({ id: "i1", archivos: [] } as any)
    expect(storage.borrados).toHaveLength(0)
    expect(fakeAdmin.tablas.informe).toHaveLength(0)
  })
})

describe("uploadArchivo", () => {
  it("sube el archivo con una ruta saneada y registra su metadata", async () => {
    const InformesService = await servicio()
    const archivo = await InformesService.uploadArchivo("inf-1", "del-1", archivoFalso({ name: "Memoria Anual 2026!!.pdf" }))

    expect(storage.subidas).toHaveLength(1)
    expect(storage.subidas[0].path).toMatch(/^del-1\/inf-1\/\d+_Memoria_Anual_2026__\.pdf$/)
    expect(archivo.nombre).toBe("Memoria Anual 2026!!.pdf")
    expect(fakeAdmin.tablas.informe_archivo[0].subido_por ?? fakeAdmin.tablas.informe_archivo[0].creado_por).toBe("user-1")
  })

  it("un PDF se marca como pdf principal por defecto", async () => {
    const InformesService = await servicio()
    const archivo = await InformesService.uploadArchivo("inf-1", "del-1", archivoFalso())
    expect(archivo.es_pdf_principal).toBe(true)
  })

  it("se puede forzar que NO sea el pdf principal", async () => {
    const InformesService = await servicio()
    const archivo = await InformesService.uploadArchivo("inf-1", "del-1", archivoFalso(), { esPdfPrincipal: false })
    expect(archivo.es_pdf_principal).toBe(false)
  })

  it("si falla registrar la metadata, deshace la subida en Storage", async () => {
    const InformesService = await servicio()
    fakeAdmin = crearFakeAdmin(tablas(), { errores: { informe_archivo: { message: "fallo simulado" } } })
    await expect(InformesService.uploadArchivo("inf-1", "del-1", archivoFalso())).rejects.toThrow()
    expect(storage.borrados).toHaveLength(1) // se limpia el archivo huérfano
  })
})

describe("addDriveLink", () => {
  it("registra el enlace sin tocar Storage", async () => {
    const InformesService = await servicio()
    const archivo = await InformesService.addDriveLink("inf-1", "Memoria en Drive", "https://drive.google.com/x")
    expect(archivo.drive_url).toBe("https://drive.google.com/x")
    expect(storage.subidas).toHaveLength(0)
  })
})

describe("removeArchivo", () => {
  it("borra de Storage y la fila cuando tiene storage_path", async () => {
    const InformesService = await servicio(
      tablas({ informe_archivo: [{ id: "a1", storage_path: "del-1/i1/x.pdf" }] }),
    )
    await InformesService.removeArchivo({ id: "a1", storage_path: "del-1/i1/x.pdf" } as any)
    expect(storage.borrados).toEqual([["del-1/i1/x.pdf"]])
    expect(fakeAdmin.tablas.informe_archivo).toHaveLength(0)
  })

  it("un enlace de Drive (sin storage_path) no llama a Storage", async () => {
    const InformesService = await servicio(tablas({ informe_archivo: [{ id: "a1", storage_path: null }] }))
    await InformesService.removeArchivo({ id: "a1", storage_path: null } as any)
    expect(storage.borrados).toHaveLength(0)
  })
})

describe("getSignedUrl", () => {
  it("devuelve la url firmada", async () => {
    const InformesService = await servicio()
    const url = await InformesService.getSignedUrl("del-1/i1/x.pdf")
    expect(url).toContain("del-1/i1/x.pdf")
  })

  it("si Storage falla, devuelve null en vez de lanzar", async () => {
    const InformesService = await servicio()
    storage.from = (() => ({
      upload: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      createSignedUrl: async () => ({ data: null, error: { message: "no encontrado" } }),
    })) as any
    expect(await InformesService.getSignedUrl("no-existe.pdf")).toBeNull()
  })
})
