/**
 * Cliente de Supabase de mentira para probar `lib/api/*` sin red.
 *
 * Imita lo justo del constructor de consultas de PostgREST que usa la capa de
 * API —`select`, `order`, `range`, `in`, `eq`, `not`, `limit`, `maybeSingle`—
 * aplicando los filtros sobre unas tablas en memoria. No pretende ser un
 * Postgres: pretende que un cambio en `resumen.ts` o `catalogos.ts` que rompa
 * la paginación o el filtrado se note en un test en vez de en producción.
 *
 * No es un fichero de test (vitest solo recoge `*.test.ts`), así que puede
 * importarse desde cualquiera de ellos.
 */

export type Fila = Record<string, any>
export type Tablas = Record<string, Fila[]>

export interface FakeAdminOpciones {
  /** Error a devolver para una tabla concreta, en vez de datos. */
  errores?: Record<string, { message: string; details?: string; hint?: string }>
  /** Usuarios que devuelve `auth.admin.listUsers`. */
  usuarios?: { id: string; email?: string | null }[]
  /** Error de `auth.admin.listUsers`. */
  errorUsuarios?: { message: string }
}

export interface FakeAdmin {
  from: (tabla: string) => any
  auth: { admin: { listUsers: (params?: any) => Promise<any> } }
  storage: { from: (bucket: string) => any }
  /** Las tablas en memoria, para comprobar el estado tras una escritura. */
  tablas: Tablas
  /** Registro de todas las consultas ejecutadas, para comprobar la paginación. */
  consultas: { tabla: string; rango?: [number, number]; orden?: string; filtros: string[] }[]
  /** Escrituras hechas, en orden. */
  escrituras: { tabla: string; tipo: "insert" | "update" | "delete"; valores?: Fila; filas: number }[]
  /** Ficheros borrados de Storage. */
  borradosStorage: { bucket: string; paths: string[] }[]
}

type Filtro = (fila: Fila) => boolean

function comparar(fila: Fila, columna: string, valor: any): boolean {
  return fila[columna] === valor
}

export function crearFakeAdmin(tablas: Tablas, opciones: FakeAdminOpciones = {}): FakeAdmin {
  const consultas: FakeAdmin["consultas"] = []
  const escrituras: FakeAdmin["escrituras"] = []
  const borradosStorage: FakeAdmin["borradosStorage"] = []
  let secuencia = 0

  function builder(tabla: string) {
    const filtros: Filtro[] = []
    const descripcion: string[] = []
    let rango: [number, number] | undefined
    let orden: string | undefined
    let ascendente = true
    let limite: number | undefined
    let unico: "single" | "maybeSingle" | undefined
    let mutacion: { tipo: "insert" | "update" | "delete"; valores?: Fila | Fila[] } | undefined

    const ejecutar = () => {
      const error = opciones.errores?.[tabla]
      if (error) return { data: null, error }

      if (mutacion) return aplicarMutacion()

      let filas = (tablas[tabla] ?? []).filter((fila) => filtros.every((f) => f(fila)))

      if (orden) {
        const columna = orden
        filas = [...filas].sort((a, b) => {
          const x = a[columna]
          const y = b[columna]
          const cmp = x === y ? 0 : x > y ? 1 : -1
          return ascendente ? cmp : -cmp
        })
      }

      if (rango) filas = filas.slice(rango[0], rango[1] + 1)
      if (limite !== undefined) filas = filas.slice(0, limite)

      consultas.push({ tabla, rango, orden, filtros: [...descripcion] })

      if (unico) {
        if (filas.length === 0) {
          return unico === "maybeSingle"
            ? { data: null, error: null }
            : { data: null, error: { message: "No rows found" } }
        }
        return { data: filas[0], error: null }
      }
      return { data: filas, error: null }
    }

    const aplicarMutacion = () => {
      tablas[tabla] ??= []
      const filas = tablas[tabla]
      const m = mutacion!

      if (m.tipo === "insert") {
        const nuevas = (Array.isArray(m.valores) ? m.valores : [m.valores!]).map((v) => ({
          id: `fake-${tabla}-${++secuencia}`,
          creado_en: "2026-01-01T00:00:00Z",
          actualizado_en: "2026-01-01T00:00:00Z",
          ...v,
        }))
        filas.push(...nuevas)
        escrituras.push({ tabla, tipo: "insert", valores: nuevas[0], filas: nuevas.length })
        const data = unico ? nuevas[0] : nuevas
        return { data, error: null, count: nuevas.length }
      }

      const afectadas = filas.filter((fila) => filtros.every((f) => f(fila)))

      if (m.tipo === "update") {
        for (const fila of afectadas) Object.assign(fila, m.valores)
        escrituras.push({
          tabla,
          tipo: "update",
          valores: m.valores as Fila,
          filas: afectadas.length,
        })
        const data = unico ? (afectadas[0] ?? null) : afectadas
        return { data, error: null, count: afectadas.length }
      }

      tablas[tabla] = filas.filter((fila) => !afectadas.includes(fila))
      escrituras.push({ tabla, tipo: "delete", filas: afectadas.length })
      return { data: afectadas, error: null, count: afectadas.length }
    }

    const api: any = {
      select: () => api,
      insert: (valores: Fila | Fila[]) => {
        mutacion = { tipo: "insert", valores }
        return api
      },
      upsert: (valores: Fila | Fila[]) => {
        mutacion = { tipo: "insert", valores }
        return api
      },
      update: (valores: Fila) => {
        mutacion = { tipo: "update", valores }
        return api
      },
      delete: () => {
        mutacion = { tipo: "delete" }
        return api
      },
      order: (columna: string, opts?: { ascending?: boolean }) => {
        orden = columna
        ascendente = opts?.ascending !== false
        return api
      },
      range: (desde: number, hasta: number) => {
        rango = [desde, hasta]
        return api
      },
      limit: (n: number) => {
        limite = n
        return api
      },
      in: (columna: string, valores: any[]) => {
        descripcion.push(`in:${columna}`)
        filtros.push((fila) => valores.includes(fila[columna]))
        return api
      },
      eq: (columna: string, valor: any) => {
        descripcion.push(`eq:${columna}`)
        filtros.push((fila) => comparar(fila, columna, valor))
        return api
      },
      neq: (columna: string, valor: any) => {
        descripcion.push(`neq:${columna}`)
        filtros.push((fila) => !comparar(fila, columna, valor))
        return api
      },
      gte: (columna: string, valor: any) => {
        descripcion.push(`gte:${columna}`)
        filtros.push((fila) => fila[columna] >= valor)
        return api
      },
      lte: (columna: string, valor: any) => {
        descripcion.push(`lte:${columna}`)
        filtros.push((fila) => fila[columna] <= valor)
        return api
      },
      gt: (columna: string, valor: any) => {
        descripcion.push(`gt:${columna}`)
        filtros.push((fila) => fila[columna] > valor)
        return api
      },
      lt: (columna: string, valor: any) => {
        descripcion.push(`lt:${columna}`)
        filtros.push((fila) => fila[columna] < valor)
        return api
      },
      is: (columna: string, valor: any) => {
        descripcion.push(`is:${columna}`)
        filtros.push((fila) => (valor === null ? fila[columna] == null : fila[columna] === valor))
        return api
      },
      ilike: (columna: string, patron: string) => {
        descripcion.push(`ilike:${columna}`)
        const regex = new RegExp(
          `^${String(patron).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
          "i",
        )
        filtros.push((fila) => regex.test(String(fila[columna] ?? "")))
        return api
      },
      or: (expresion: string) => {
        // `or("a.ilike.%x%,b.ilike.%x%")`: basta con un OR de "contiene".
        const partes = expresion.split(",").map((p) => p.split("."))
        descripcion.push("or")
        filtros.push((fila) =>
          partes.some(([columna, , valor]) =>
            String(fila[columna] ?? "")
              .toLowerCase()
              .includes(String(valor ?? "").replace(/%/g, "").toLowerCase()),
          ),
        )
        return api
      },
      // `not("estado", "in", "(a,b)")` es como lo escribe PostgREST.
      not: (columna: string, operador: string, valor: any) => {
        descripcion.push(`not:${columna}`)
        if (operador === "in") {
          const lista = String(valor)
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((v) => v.trim())
          filtros.push((fila) => !lista.includes(String(fila[columna])))
        } else if (operador === "is") {
          filtros.push((fila) => fila[columna] != null)
        }
        return api
      },
      single: () => {
        unico = "single"
        return api
      },
      maybeSingle: () => {
        unico = "maybeSingle"
        return api
      },
      then: (resolver: (v: any) => any, rechazar?: (e: any) => any) =>
        Promise.resolve(ejecutar()).then(resolver, rechazar),
    }

    return api
  }

  return {
    from: builder,
    tablas,
    consultas,
    escrituras,
    borradosStorage,
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          borradosStorage.push({ bucket, paths })
          return { data: null, error: null }
        },
        upload: async () => ({ data: { path: "subido" }, error: null }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/${bucket}/${path}?firma=1` },
          error: null,
        }),
      }),
    },
    auth: {
      admin: {
        listUsers: async () =>
          opciones.errorUsuarios
            ? { data: null, error: opciones.errorUsuarios }
            : { data: { users: opciones.usuarios ?? [] }, error: null },
      },
    },
  }
}
