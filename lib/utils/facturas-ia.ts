/**
 * Normalización y saneado de lo que devuelve el modelo al leer una factura.
 *
 * Vive aparte del núcleo (`lib/api/factura-ia.ts`) por dos motivos: son
 * funciones puras y por tanto testeables sin base de datos, y porque son la
 * frontera de confianza. Todo lo que sale del modelo pasa por aquí antes de
 * tocar una fila: una fecha en formato español, un importe con coma decimal o
 * un "N/A" donde debería ir un número no pueden llegar a la base de datos tal
 * cual.
 */

/** Sin acentos, en minúsculas y con los espacios colapsados. */
export function normalizarNombre(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * NIF/CIF comparable: solo alfanuméricos en mayúsculas. Así "B-12.345.678" y
 * "b12345678" son el mismo proveedor.
 */
export function normalizarNif(valor: string | null | undefined): string | null {
  const limpio = String(valor ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  // Un NIF español tiene 9 caracteres; se admite algo más por si viene con
  // prefijo de país (ESB12345678) o es un identificador extranjero.
  return limpio.length >= 8 && limpio.length <= 15 ? limpio : null
}

const RANGO_MIN = "2000-01-01"

/**
 * Fecha de emisión en `AAAA-MM-DD`.
 *
 * Admite lo que suele salir de una factura española (`12/03/2026`, `12-03-26`,
 * `12.03.2026`) además del ISO. Se construye con getters UTC y comparación de
 * cadenas, nunca con `new Date(...)` en hora local: el mismo motivo por el que
 * `lib/utils/import-parsing.ts` existe (un desfase de zona horaria movía las
 * fechas un día en las importaciones).
 */
export function parsearFechaFactura(
  valor: unknown,
  hoy: Date = new Date(),
): string | null {
  const texto = String(valor ?? "").trim()
  if (!texto) return null

  let anio: number, mes: number, dia: number

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const europea = texto.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/)

  if (iso) {
    anio = Number(iso[1])
    mes = Number(iso[2])
    dia = Number(iso[3])
  } else if (europea) {
    dia = Number(europea[1])
    mes = Number(europea[2])
    anio = Number(europea[3])
    if (anio < 100) anio += anio >= 70 ? 1900 : 2000
  } else {
    return null
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  // Comprobación de fecha real (31 de febrero no existe).
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null
  }

  const formateada = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`

  // Fuera de rango razonable = lectura equivocada (un número de factura leído
  // como fecha, por ejemplo). Mejor no rellenar nada que rellenar una fecha
  // falsa que luego nadie revisa.
  const limiteSuperior = new Date(
    Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), hoy.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10)
  if (formateada < RANGO_MIN || formateada > limiteSuperior) return null

  return formateada
}

/**
 * Importe total en positivo con dos decimales.
 *
 * El modelo devuelve un número por contrato del schema, pero puede colarse una
 * cadena ("1.234,56 €") si el schema se relaja o el modelo se sale del carril;
 * se admite y se interpreta con las reglas españolas (coma decimal, punto de
 * millares).
 */
export function parsearImporteFactura(valor: unknown): number | null {
  let n: number

  if (typeof valor === "number") {
    n = valor
  } else {
    const texto = String(valor ?? "")
      .replace(/[^\d,.\-]/g, "")
      .trim()
    if (!texto) return null

    const ultimaComa = texto.lastIndexOf(",")
    const ultimoPunto = texto.lastIndexOf(".")
    let normalizado: string
    if (ultimaComa > ultimoPunto) {
      // 1.234,56 → el separador decimal es la coma
      normalizado = texto.replace(/\./g, "").replace(",", ".")
    } else {
      // 1,234.56 o 1234.56
      normalizado = texto.replace(/,/g, "")
    }
    n = Number(normalizado)
  }

  if (!Number.isFinite(n)) return null
  const positivo = Math.abs(n)
  if (positivo <= 0) return null
  // Un importe absurdo es casi siempre un número de factura leído como total.
  if (positivo > 10_000_000) return null
  return Math.round(positivo * 100) / 100
}

/** Recorta a `max` caracteres sin dejar la cadena vacía ni con espacios sueltos. */
export function recortar(valor: unknown, max: number): string | null {
  const texto = String(valor ?? "").replace(/\s+/g, " ").trim()
  if (!texto) return null
  return texto.length > max ? texto.slice(0, max).trim() : texto
}

/** Moneda ISO-4217 de tres letras; si no lo parece, EUR. */
export function parsearMoneda(valor: unknown): string {
  const texto = String(valor ?? "").trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(texto)) return texto
  if (texto.includes("€") || texto.includes("EURO")) return "EUR"
  return "EUR"
}
