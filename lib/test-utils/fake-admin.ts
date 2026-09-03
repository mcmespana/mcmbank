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
  errores?: Record<string, { message: string; details?: string; hint?: string; code?: string }>
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

/**
 * Parte un `or=(...)` de PostgREST por comas, respetando las que van dentro de
 * comillas dobles (el texto de búsqueda puede llevarlas: "Mercadona, S.A.").
 */
function partirOr(expresion: string): string[] {
  const partes: string[] = []
  let actual = ""
  let entreComillas = false
  for (let i = 0; i < expresion.length; i++) {
    const c = expresion[i]
    if (c === "\\" && entreComillas) {
      actual += expresion[++i] ?? ""
      continue
    }
    if (c === '"') {
      entreComillas = !entreComillas
      continue
    }
    if (c === "," && !entreComillas) {
      partes.push(actual)
      actual = ""
      continue
    }
    actual += c
  }
  if (actual) partes.push(actual)
  return partes
}

/** Convierte `"importe.gte.50"` o `"concepto.ilike.%merca%"` en un predicado. */
function condicionDeTexto(condicion: string): Filtro {
  const primero = condicion.indexOf(".")
  const segundo = condicion.indexOf(".", primero + 1)
  const columna = condicion.slice(0, primero)
  const operador = condicion.slice(primero + 1, segundo)
  const bruto = condicion.slice(segundo + 1)
  const numero = Number(bruto)

  switch (operador) {
    case "gte":
      return (fila) => Number(fila[columna]) >= numero
    case "lte":
      return (fila) => Number(fila[columna]) <= numero
    case "gt":
      return (fila) => Number(fila[columna]) > numero
    case "lt":
      return (fila) => Number(fila[columna]) < numero
    case "is":
      return (fila) => (bruto === "null" ? fila[columna] == null : String(fila[columna]) === bruto)
    case "ilike": {
      const regex = new RegExp(
        `^${bruto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
        "i",
      )
      return (fila) => regex.test(String(fila[columna] ?? ""))
    }
    default:
      return (fila) => String(fila[columna]) === bruto
  }
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
    const ordenes: { columna: string; ascendente: boolean }[] = []
    let limite: number | undefined
    let unico: "single" | "maybeSingle" | undefined
    let mutacion:
      | {
          tipo: "insert" | "update" | "delete" | "upsert"
          valores?: Fila | Fila[]
          onConflict?: string
          ignoreDuplicates?: boolean
        }
      | undefined
    let contarExacto = false

    const ejecutar = () => {
      const error = opciones.errores?.[tabla]
      if (error) return { data: null, error }

      if (mutacion) return aplicarMutacion()

      let filas = (tablas[tabla] ?? []).filter((fila) => filtros.every((f) => f(fila)))
      // `count: "exact"` cuenta TODAS las filas que casan, antes de paginar.
      const total = filas.length

      if (ordenes.length > 0) {
        // PostgREST encadena los `order()`: el segundo desempata al primero.
        filas = [...filas].sort((a, b) => {
          for (const { columna, ascendente } of ordenes) {
            const x = a[columna]
            const y = b[columna]
            if (x === y) continue
            const cmp = x > y ? 1 : -1
            return ascendente ? cmp : -cmp
          }
          return 0
        })
      }

      if (rango) filas = filas.slice(rango[0], rango[1] + 1)
      if (limite !== undefined) filas = filas.slice(0, limite)

      consultas.push({ tabla, rango, orden: ordenes[0]?.columna, filtros: [...descripcion] })

      // Clonado a propósito: en Supabase real cada respuesta es JSON
      // deserializado aparte, así que mutar la fila ya leída (p. ej. tras un
      // `update()` posterior sobre la misma id) nunca cambia un objeto que
      // ya tenías en la mano. Sin este clon, dos pasos típicos —"leo la fila,
      // luego la actualizo"— comparten referencia y el `update` reescribe
      // retroactivamente el valor "antiguo" que se acababa de leer.
      if (unico) {
        if (filas.length === 0) {
          return unico === "maybeSingle"
            ? { data: null, error: null, count: 0 }
            : { data: null, error: { message: "No rows found" }, count: 0 }
        }
        // Con más de una fila, PostgREST NO devuelve la primera: contesta 406
        // con PGRST116. Devolver aquí `filas[0]` era mentira cómoda, y dejó
        // pasar un `maybeSingle()` sobre las membresías de gestor central que
        // en producción respondía error —y por tanto 403— a cualquier admin
        // con más de una delegación.
        if (filas.length > 1) {
          return {
            data: null,
            error: {
              message: "JSON object requested, multiple (or no) rows returned",
              details: `Results contain ${filas.length} rows, application/vnd.pgrst.object+json requires 1 row`,
              hint: null,
              code: "PGRST116",
            },
            count: total,
          }
        }
        return { data: structuredClone(filas[0]), error: null, count: total }
      }
      return { data: structuredClone(filas), error: null, count: contarExacto ? total : null }
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

      // `upsert(..., { onConflict })`: a diferencia de `insert`, una fila cuyas
      // columnas de conflicto ya existen se actualiza en el sitio en vez de
      // duplicarse (salvo `ignoreDuplicates`, que la deja tal cual).
      if (m.tipo === "upsert") {
        const entradas = Array.isArray(m.valores) ? m.valores : [m.valores!]
        const columnas = m.onConflict?.split(",").map((c) => c.trim())
        const afectadas: Fila[] = []
        let insertadas = 0

        for (const entrada of entradas) {
          const existente = columnas
            ? filas.find((f) => columnas.every((c) => f[c] === entrada[c]))
            : undefined
          if (existente) {
            if (!m.ignoreDuplicates) Object.assign(existente, entrada)
            afectadas.push(existente)
          } else {
            const nueva = {
              id: `fake-${tabla}-${++secuencia}`,
              creado_en: "2026-01-01T00:00:00Z",
              actualizado_en: "2026-01-01T00:00:00Z",
              ...entrada,
            }
            filas.push(nueva)
            afectadas.push(nueva)
            insertadas += 1
          }
        }

        escrituras.push({ tabla, tipo: "insert", valores: afectadas[0], filas: insertadas })
        const data = unico ? (afectadas[0] ?? null) : afectadas
        return { data, error: null, count: afectadas.length }
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
      select: (_columnas?: string, opciones?: { count?: string }) => {
        if (opciones?.count === "exact") contarExacto = true
        return api
      },
      insert: (valores: Fila | Fila[]) => {
        mutacion = { tipo: "insert", valores }
        return api
      },
      upsert: (
        valores: Fila | Fila[],
        opciones?: { onConflict?: string; ignoreDuplicates?: boolean; count?: string },
      ) => {
        mutacion = {
          tipo: "upsert",
          valores,
          onConflict: opciones?.onConflict,
          ignoreDuplicates: opciones?.ignoreDuplicates,
        }
        if (opciones?.count === "exact") contarExacto = true
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
        ordenes.push({ columna, ascendente: opts?.ascending !== false })
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
      match: (condiciones: Record<string, any>) => {
        for (const [columna, valor] of Object.entries(condiciones)) {
          descripcion.push(`eq:${columna}`)
          filtros.push((fila) => comparar(fila, columna, valor))
        }
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
        descripcion.push("or")
        const condiciones = partirOr(expresion).map(condicionDeTexto)
        filtros.push((fila) => condiciones.some((c) => c(fila)))
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
      abortSignal: (_signal: AbortSignal) => api,
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
        download: async (_path: string) => ({
          data: { arrayBuffer: async () => new TextEncoder().encode("contenido de mentira").buffer },
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
