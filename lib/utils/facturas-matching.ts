import type { FacturaConRelaciones, MovimientoConRelaciones } from "@/lib/types/database"
import { normalizarClaveProveedor } from "@/lib/utils/proveedor-logo"

/**
 * Lógica pura de conciliación factura ↔ movimiento.
 *
 * Vive separada de `lib/utils/facturas.ts` (que arrastra iconos y clases de
 * Tailwind para la interfaz) para que el servidor —la API externa y el servidor
 * MCP— pueda puntuar candidatos sin importar nada de React.
 */

/** Suma de los movimientos ya vinculados a una factura (valor absoluto). */
export function importePagadoFactura(factura: Pick<FacturaConRelaciones, "movimientos">): number {
  return (factura.movimientos ?? []).reduce((sum, m) => sum + Math.abs(Number(m.importe)), 0)
}

/**
 * Importe que le falta a la factura por cubrir (null si no tiene importe
 * definido). Nunca negativo.
 *
 * El importe se toma en valor absoluto igual que el de los movimientos: la app
 * lo guarda en positivo (es lo que hay que pagar, no un apunte con signo), pero
 * una fila antigua o venida de la API externa puede traerlo en negativo, y
 * entonces el pendiente salía 0 —acotado por el `max`— y la factura dejaba de
 * encontrar candidatos en silencio.
 */
export function importePendienteFactura(
  factura: Pick<FacturaConRelaciones, "movimientos" | "importe">,
): number | null {
  if (factura.importe == null) return null
  return Math.max(Math.abs(Number(factura.importe)) - importePagadoFactura(factura), 0)
}

/**
 * Margen de importe para buscar movimientos candidatos de una factura:
 * un 2% del importe con un mínimo de 0,50 € ("un pelín de margen").
 */
export function margenImporteFactura(importe: number): number {
  return Math.max(Math.abs(importe) * 0.02, 0.5)
}

/**
 * Cadenas que aparecen con su nombre en el extracto del banco, casi siempre
 * igual: "COMPRA TARJ. MERCADONA 4021", "AMZN MKTP ES*2K4LP".
 *
 * Se listan porque con ellas se puede ser mucho más exigente que con un
 * proveedor cualquiera: si la factura es de Mercadona y el concepto dice
 * Amazon, no es ese movimiento por mucho que el importe y el día cuadren —que
 * es justo lo que pasa con las dos, porque son las que más apuntes generan.
 * Con un proveedor que no está aquí no se puede concluir nada del silencio:
 * su nombre casi nunca sale en el extracto.
 *
 * `patrones` va normalizado (minúsculas, sin acentos, palabras sueltas) y se
 * busca por palabras completas, así que "dia" no se cuela dentro de "diagonal".
 */
const CADENAS_EN_EXTRACTO: readonly { clave: string; patrones: readonly string[] }[] = [
  { clave: "mercadona", patrones: ["mercadona"] },
  { clave: "amazon", patrones: ["amazon", "amzn", "amz mktp", "amazon mktpl"] },
  { clave: "carrefour", patrones: ["carrefour"] },
  { clave: "lidl", patrones: ["lidl"] },
  { clave: "aldi", patrones: ["aldi"] },
  { clave: "alcampo", patrones: ["alcampo"] },
  { clave: "consum", patrones: ["consum"] },
  { clave: "eroski", patrones: ["eroski"] },
  { clave: "ahorramas", patrones: ["ahorramas"] },
  { clave: "makro", patrones: ["makro"] },
  { clave: "ikea", patrones: ["ikea"] },
  { clave: "leroy merlin", patrones: ["leroy merlin", "leroymerlin"] },
  { clave: "bricomart", patrones: ["bricomart"] },
  { clave: "bricodepot", patrones: ["bricodepot", "brico depot"] },
  { clave: "decathlon", patrones: ["decathlon"] },
  { clave: "el corte ingles", patrones: ["corte ingles", "elcorteingles"] },
  { clave: "primark", patrones: ["primark"] },
  { clave: "mediamarkt", patrones: ["mediamarkt", "media markt"] },
  { clave: "pccomponentes", patrones: ["pccomponentes"] },
  { clave: "worten", patrones: ["worten"] },
  { clave: "fnac", patrones: ["fnac"] },
  { clave: "aliexpress", patrones: ["aliexpress"] },
  { clave: "temu", patrones: ["temu"] },
  { clave: "repsol", patrones: ["repsol"] },
  { clave: "cepsa", patrones: ["cepsa"] },
  { clave: "galp", patrones: ["galp"] },
  { clave: "renfe", patrones: ["renfe"] },
  { clave: "alsa", patrones: ["alsa"] },
  { clave: "correos", patrones: ["correos"] },
  { clave: "glovo", patrones: ["glovo"] },
  { clave: "movistar", patrones: ["movistar", "telefonica"] },
  { clave: "vodafone", patrones: ["vodafone"] },
  { clave: "orange", patrones: ["orange"] },
  { clave: "endesa", patrones: ["endesa"] },
  { clave: "iberdrola", patrones: ["iberdrola"] },
  { clave: "naturgy", patrones: ["naturgy"] },
]

/** Minúsculas, sin acentos y sin puntuación, para comparar textos libres. */
function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** ¿Aparece `patron` en `texto` como palabra(s) completa(s)? */
function contienePalabras(texto: string, patron: string): boolean {
  return ` ${texto} `.includes(` ${patron} `)
}

/** Las cadenas conocidas que nombra un texto (normalizado). */
function cadenasEn(texto: string): Set<string> {
  const encontradas = new Set<string>()
  for (const cadena of CADENAS_EN_EXTRACTO) {
    if (cadena.patrones.some((p) => contienePalabras(texto, p))) encontradas.add(cadena.clave)
  }
  return encontradas
}

export interface CandidatoScore {
  score: number
  importeExacto: boolean
  fechaCercana: boolean
  mismoContacto: boolean
  /** El concepto del movimiento nombra al proveedor de la factura. */
  nombreEnConcepto: boolean
  /**
   * El proveedor de la factura es una cadena reconocible y el concepto del
   * movimiento nombra a otra distinta: no es este movimiento.
   */
  otroProveedorEnConcepto: boolean
}

/**
 * Puntúa un movimiento como candidato para una factura. El precio manda:
 * importe exacto pesa mucho más que la fecha; el contacto ayuda a desempatar.
 *
 * El texto del movimiento entra como tercera señal, con dos niveles de
 * exigencia: para cualquier proveedor, encontrar su nombre en el concepto suma
 * (pero no encontrarlo no resta, porque el extracto rara vez lo trae); para las
 * cadenas de `CADENAS_EN_EXTRACTO`, además, ver ahí el nombre de OTRA cadena
 * descarta el candidato.
 */
export function scoreCandidatoMovimiento(
  factura: {
    importe?: number | null
    fecha_emision?: string | null
    contacto_id?: string | null
    /** Nombre del proveedor, para cotejarlo con el texto del movimiento. */
    contacto_nombre?: string | null
  },
  movimiento: Pick<MovimientoConRelaciones, "importe" | "fecha" | "contacto_id"> & {
    concepto?: string | null
    descripcion?: string | null
    contraparte?: string | null
  },
): CandidatoScore {
  let score = 0

  const importeExacto =
    factura.importe != null && Math.abs(Math.abs(Number(movimiento.importe)) - Math.abs(Number(factura.importe))) < 0.005
  if (importeExacto) score += 4
  else if (factura.importe != null) score += 1 // dentro del margen (la query ya filtró)

  let fechaCercana = false
  if (factura.fecha_emision && movimiento.fecha) {
    const diffDias = Math.abs(
      (new Date(movimiento.fecha).getTime() - new Date(factura.fecha_emision).getTime()) / 86400000,
    )
    if (diffDias <= 5) {
      score += 2
      fechaCercana = true
    } else if (diffDias <= 20) {
      score += 1
    }
  }

  const mismoContacto = Boolean(factura.contacto_id && movimiento.contacto_id === factura.contacto_id)
  if (mismoContacto) score += 2

  const texto = normalizarTexto(
    [movimiento.concepto, movimiento.contraparte, movimiento.descripcion].filter(Boolean).join(" "),
  )
  const proveedor = normalizarClaveProveedor(factura.contacto_nombre)

  let nombreEnConcepto = false
  let otroProveedorEnConcepto = false

  if (texto && proveedor) {
    const cadenaProveedor = CADENAS_EN_EXTRACTO.find((c) =>
      c.patrones.some((p) => contienePalabras(proveedor, p)),
    )
    const cadenasTexto = cadenasEn(texto)

    if (cadenaProveedor) {
      // Proveedor reconocible: aquí sí se puede concluir. Que esté es una
      // confirmación fuerte; que esté OTRA cadena es un descarte.
      if (cadenasTexto.has(cadenaProveedor.clave)) {
        nombreEnConcepto = true
        score += 4
      } else if (cadenasTexto.size > 0) {
        otroProveedorEnConcepto = true
        score -= 6
      }
    } else {
      // Proveedor cualquiera: solo se premia el acierto. El nombre completo
      // vale más que una palabra suelta, y las de menos de cuatro letras no
      // cuentan porque coinciden con cualquier cosa.
      if (contienePalabras(texto, proveedor)) {
        nombreEnConcepto = true
        score += 3
      } else {
        const palabras = proveedor.split(" ").filter((p) => p.length >= 4)
        const aciertos = palabras.filter((p) => contienePalabras(texto, p))
        if (aciertos.length > 0) {
          nombreEnConcepto = true
          score += aciertos.length === palabras.length ? 3 : 2
        }
      }
    }
  }

  return { score, importeExacto, fechaCercana, mismoContacto, nombreEnConcepto, otroProveedorEnConcepto }
}

/**
 * Un candidato es "match directo" si tiene importe exacto y destaca claramente
 * sobre el segundo (o es el único).
 *
 * Un concepto que nombra a otra cadena nunca lo es, aunque el importe y la
 * fecha cuadren: es exactamente el caso de la factura de Mercadona y el pago de
 * Amazon del mismo día por el mismo importe.
 */
export function esMatchDirecto(scores: CandidatoScore[]): boolean {
  if (scores.length === 0) return false
  const [primero, segundo] = scores
  if (!primero.importeExacto) return false
  if (primero.otroProveedorEnConcepto) return false
  if (!segundo) return true
  return primero.score >= segundo.score + 2
}
