import { badRequest } from "@/lib/api/errors"

/**
 * Lectura tolerante de los argumentos que llegan de un modelo.
 *
 * Un LLM manda `"50"` donde el esquema dice número, `"Sevilla"` donde dice
 * lista, o `"true"` donde dice booleano. Nada de eso es un error del usuario ni
 * merece un rechazo: se normaliza y se sigue. Lo que sí se rechaza —con un
 * mensaje que dice exactamente qué llegó— es lo que no se puede interpretar sin
 * adivinar.
 */

export type Args = Record<string, unknown>

export function texto(args: Args, campo: string): string | undefined {
  const valor = args[campo]
  if (valor == null) return undefined
  if (typeof valor === "string") return valor.trim() || undefined
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor)
  throw badRequest(`'${campo}' debe ser texto y ha llegado ${JSON.stringify(valor)}.`)
}

export function textoObligatorio(args: Args, campo: string): string {
  const valor = texto(args, campo)
  if (!valor) throw badRequest(`Falta '${campo}'.`)
  return valor
}

export function numero(args: Args, campo: string): number | undefined {
  const valor = args[campo]
  if (valor == null || valor === "") return undefined
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."))
  if (!Number.isFinite(n)) {
    throw badRequest(`'${campo}' debe ser un número y ha llegado ${JSON.stringify(valor)}.`)
  }
  return n
}

export function booleano(args: Args, campo: string): boolean | undefined {
  const valor = args[campo]
  if (valor == null || valor === "") return undefined
  if (typeof valor === "boolean") return valor
  const texto = String(valor).toLowerCase()
  if (["true", "si", "sí", "1", "yes"].includes(texto)) return true
  if (["false", "no", "0"].includes(texto)) return false
  throw badRequest(`'${campo}' debe ser true o false y ha llegado ${JSON.stringify(valor)}.`)
}

/** Lista de textos; acepta también un único valor suelto o una lista separada por comas. */
export function lista(args: Args, campo: string): string[] | undefined {
  const valor = args[campo]
  if (valor == null || valor === "") return undefined
  if (Array.isArray(valor)) {
    const limpia = valor.map((v) => String(v).trim()).filter(Boolean)
    return limpia.length > 0 ? limpia : undefined
  }
  if (typeof valor === "string") {
    const limpia = valor.split(",").map((v) => v.trim()).filter(Boolean)
    return limpia.length > 0 ? limpia : undefined
  }
  throw badRequest(`'${campo}' debe ser una lista de textos y ha llegado ${JSON.stringify(valor)}.`)
}

export function objeto(args: Args, campo: string): Args | undefined {
  const valor = args[campo]
  if (valor == null) return undefined
  if (typeof valor === "object" && !Array.isArray(valor)) return valor as Args
  throw badRequest(`'${campo}' debe ser un objeto y ha llegado ${JSON.stringify(valor)}.`)
}

export function listaDeObjetos(args: Args, campo: string): Args[] | undefined {
  const valor = args[campo]
  if (valor == null) return undefined
  if (!Array.isArray(valor)) {
    throw badRequest(`'${campo}' debe ser una lista y ha llegado ${JSON.stringify(valor)}.`)
  }
  return valor.map((item, i) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw badRequest(`El elemento ${i + 1} de '${campo}' debería ser un objeto.`)
    }
    return item as Args
  })
}

/**
 * Normaliza una fecha suelta a `YYYY-MM-DD`. Acepta lo que ya viene bien y
 * también `DD/MM/AAAA`, que es como se escribe en España.
 */
export function fecha(args: Args, campo: string): string | undefined {
  const valor = texto(args, campo)
  if (!valor) return undefined

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor

  const espanola = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (espanola) {
    const [, dia, mes, anio] = espanola
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`
  }

  const parseada = new Date(valor)
  if (!Number.isNaN(parseada.getTime())) return parseada.toISOString().slice(0, 10)

  throw badRequest(
    `No entiendo la fecha '${valor}' en '${campo}'. Usa el formato AAAA-MM-DD.`,
  )
}

/** Valida contra una lista cerrada, diciendo cuáles son los valores válidos. */
export function opcion<T extends string>(
  args: Args,
  campo: string,
  validos: readonly T[],
): T | undefined {
  const valor = texto(args, campo)
  if (!valor) return undefined
  if (!validos.includes(valor as T)) {
    throw badRequest(`'${valor}' no vale para '${campo}'.`, { valores_validos: validos })
  }
  return valor as T
}
