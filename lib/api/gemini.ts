import { ApiError } from "@/lib/api/errors"

/**
 * Cliente mínimo de la API de Gemini, por `fetch` pelado.
 *
 * Se usa para leer facturas (`lib/api/factura-ia.ts`), y está pensado para que
 * cualquier otra lectura estructurada futura (categorizar movimientos, por
 * ejemplo) pueda reutilizarlo sin tocarlo.
 *
 * Por qué sin SDK: el repo ya habla con Resend y con Enable Banking por `fetch`,
 * y aquí solo se necesita **una** llamada de un solo turno. Añadir
 * `@google/genai` traería un árbol de dependencias entero para ahorrar treinta
 * líneas, y una dependencia más que mantener al día.
 *
 * Todo lo que pide este módulo es **salida estructurada**: se le pasa un JSON
 * Schema —que `aEsquemaGemini()` traduce al subconjunto de OpenAPI que acepta
 * `generateContent`— y el modelo está obligado a responder con un JSON que
 * encaje contra él. Nunca se
 * le dan herramientas ni se ejecuta nada de lo que responde: el documento que
 * lee es contenido no confiable (llega por correo desde fuera), así que la
 * única salida posible es rellenar los campos del schema, que luego se validan
 * uno a uno en el llamador.
 */

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const TIMEOUT_MS = 60_000

export const GEMINI_MODELO_POR_DEFECTO = "gemini-3.7-flash"

/** Los únicos valores que acepta `thinkingConfig.thinkingLevel`. */
const NIVELES_RAZONAMIENTO = ["low", "medium", "high"] as const

/** Tipos de documento que el modelo sabe leer y que aquí se le mandan. */
export const GEMINI_MIME_SOPORTADOS = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
] as const

export function geminiConfigurado(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export function modeloGemini(): string {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_MODELO_POR_DEFECTO
}

function nivelRazonamiento(pedido?: string): string {
  const valor = (pedido || process.env.GEMINI_THINKING_LEVEL || "").trim().toLowerCase()
  return (NIVELES_RAZONAMIENTO as readonly string[]).includes(valor) ? valor : "low"
}

/**
 * `generationConfig.responseSchema` **no** es JSON Schema.
 *
 * Es el subconjunto de OpenAPI 3.0 que entiende `generateContent`, y la
 * diferencia que muerde es la nulabilidad: JSON Schema la escribe
 * `{"type": ["string", "null"]}` y aquí eso es un 400 —el campo `type` es un
 * enum de un solo valor—, hay que decirlo con `{"type": "string", "nullable":
 * true}`. El error que devuelve Google no menciona el modelo para nada, así que
 * es facilísimo confundirlo con "el modelo no existe" y perder la tarde
 * cambiando `GEMINI_MODEL`.
 *
 * Esta función traduce, en vez de obligar a escribir los schemas ya
 * traducidos, porque el schema de facturas se construye a mano
 * (`construirSchema()` en `factura-ia.ts`) y cualquier otro que se añada
 * mañana se escribirá igual: en JSON Schema, que es lo que todo el mundo tiene
 * en la cabeza. Las claves que el subconjunto no reconoce se descartan aquí
 * mismo, porque una clave desconocida también es un 400.
 */
const CLAVES_SOPORTADAS = new Set([
  "type",
  "format",
  "title",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "propertyOrdering",
])

export function aEsquemaGemini(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return {}
  const entrada = schema as Record<string, unknown>
  const salida: Record<string, unknown> = {}

  for (const [clave, valor] of Object.entries(entrada)) {
    if (!CLAVES_SOPORTADAS.has(clave)) continue

    if (clave === "type") {
      // `["string", "null"]` -> type: "string" + nullable: true.
      if (Array.isArray(valor)) {
        const tipos = valor.filter((t) => typeof t === "string") as string[]
        const concretos = tipos.filter((t) => t !== "null")
        if (tipos.includes("null")) salida.nullable = true
        // Sin tipo concreto (solo "null") el schema no dice nada: se omite el
        // campo `type` y Gemini acepta cualquier valor, que es lo más honesto.
        if (concretos.length > 0) salida.type = concretos[0]
      } else if (typeof valor === "string") {
        if (valor === "null") salida.nullable = true
        else salida.type = valor
      }
      continue
    }

    if (clave === "properties" && valor && typeof valor === "object") {
      const propiedades: Record<string, unknown> = {}
      for (const [nombre, sub] of Object.entries(valor as Record<string, unknown>)) {
        propiedades[nombre] = aEsquemaGemini(sub)
      }
      salida.properties = propiedades
      continue
    }

    if (clave === "items") {
      salida.items = aEsquemaGemini(valor)
      continue
    }

    salida[clave] = valor
  }

  // `nullable` explícito en la entrada manda sobre el deducido del array.
  if (typeof entrada.nullable === "boolean") salida.nullable = entrada.nullable

  return salida
}

export interface DocumentoGemini {
  mime: string
  /** Contenido del documento en base64, sin prefijo `data:`. */
  base64: string
}

export interface PeticionGemini {
  instrucciones: string
  prompt: string
  /** JSON Schema (subconjunto soportado por Gemini) de la respuesta esperada. */
  schema: Record<string, unknown>
  documento?: DocumentoGemini | null
  /** "low" (por defecto) | "medium" | "high". */
  nivelRazonamiento?: string
}

export interface RespuestaGemini<T> {
  datos: T
  modelo: string
  tokensEntrada: number | null
  tokensSalida: number | null
}

/**
 * Una llamada, respuesta en JSON validada contra `schema`.
 *
 * Reintenta una vez ante 429/5xx (los rate limits del tier gratuito son
 * habituales y un segundo intento a los dos segundos suele bastar). Cualquier
 * otro fallo se convierte en `ApiError` con un mensaje que explica qué pasó,
 * porque estos mensajes acaban en la UI y en las respuestas del servidor MCP.
 */
export async function generarJson<T>(peticion: PeticionGemini): Promise<RespuestaGemini<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ApiError(
      503,
      "La lectura automática con IA no está configurada: falta la variable de entorno GEMINI_API_KEY.",
    )
  }

  const modelo = modeloGemini()
  const partes: Record<string, unknown>[] = []
  if (peticion.documento) {
    partes.push({
      inline_data: { mime_type: peticion.documento.mime, data: peticion.documento.base64 },
    })
  }
  partes.push({ text: peticion.prompt })

  const cuerpo = {
    system_instruction: { parts: [{ text: peticion.instrucciones }] },
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: aEsquemaGemini(peticion.schema),
      thinkingConfig: { thinkingLevel: nivelRazonamiento(peticion.nivelRazonamiento) },
    },
  }

  let ultimoError: string | null = null
  for (let intento = 0; intento < 2; intento += 1) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 2000))

    const control = new AbortController()
    const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS)
    let respuesta: Response
    try {
      respuesta = await fetch(`${ENDPOINT_BASE}/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      })
    } catch (err) {
      ultimoError =
        (err as any)?.name === "AbortError"
          ? `el modelo tardó más de ${TIMEOUT_MS / 1000} s en responder`
          : `no se pudo contactar con Gemini (${(err as any)?.message ?? "error de red"})`
      continue
    } finally {
      clearTimeout(temporizador)
    }

    if (!respuesta.ok) {
      const detalle = (await respuesta.text().catch(() => "")).slice(0, 2000)
      // La clave, el modelo y la forma de la petición son problemas de
      // configuración: no se reintentan, y el mensaje tiene que decir cuál de
      // los tres es. Google lo explica bien en el cuerpo; el error genérico que
      // había aquí antes lo tiraba y mandaba a revisar la API key aunque el
      // problema fuera el schema.
      if (respuesta.status === 400 || respuesta.status === 401 || respuesta.status === 403) {
        console.error("Gemini rechazó la petición:", respuesta.status, detalle)
        throw new ApiError(502, `Gemini rechazó la petición (${respuesta.status}): ${mensajeDeGoogle(detalle)}`)
      }
      if (respuesta.status === 404) {
        console.error("Gemini no encontró el modelo:", modelo, detalle)
        throw new ApiError(502, `El modelo '${modelo}' no existe.${await pistaDeModelos(apiKey)}`)
      }
      ultimoError = `Gemini respondió ${respuesta.status}`
      console.warn("Gemini respondió con error:", respuesta.status, detalle)
      continue
    }

    const json = (await respuesta.json().catch(() => null)) as any
    const texto = extraerTexto(json)
    if (!texto) {
      ultimoError = "Gemini devolvió una respuesta vacía"
      continue
    }

    let datos: T
    try {
      datos = JSON.parse(texto) as T
    } catch {
      ultimoError = "Gemini devolvió algo que no es JSON"
      console.warn("Respuesta no parseable de Gemini:", texto.slice(0, 300))
      continue
    }

    return {
      datos,
      modelo,
      tokensEntrada: json?.usageMetadata?.promptTokenCount ?? null,
      tokensSalida: json?.usageMetadata?.candidatesTokenCount ?? null,
    }
  }

  throw new ApiError(502, `No se pudo leer el documento con IA: ${ultimoError ?? "error desconocido"}.`)
}

/**
 * Lo que Google explica en el cuerpo del error, que es lo único que dice de
 * verdad qué está mal (`{"error": {"message": "..."}}`).
 */
function mensajeDeGoogle(cuerpo: string): string {
  try {
    const mensaje = JSON.parse(cuerpo)?.error?.message
    if (typeof mensaje === "string" && mensaje.trim()) return mensaje.trim().slice(0, 300)
  } catch {
    // No era JSON: se devuelve el texto tal cual, recortado.
  }
  return cuerpo.trim().slice(0, 300) || "sin detalle"
}

/**
 * Los modelos que la clave puede usar de verdad, para el 404.
 *
 * Es justo el dato que hace falta cuando el nombre del modelo se ha quedado
 * viejo, y es un `GET` sin coste. Si falla, se calla: es una pista, no el
 * error.
 */
async function pistaDeModelos(apiKey: string): Promise<string> {
  try {
    const respuesta = await fetch(`${ENDPOINT_BASE}?pageSize=200`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!respuesta.ok) return ""
    const json = (await respuesta.json()) as any
    const nombres = (json?.models ?? [])
      .filter((m: any) => m?.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => String(m?.name ?? "").replace(/^models\//, ""))
      .filter((n: string) => n.includes("flash"))
      .slice(0, 8)
    if (nombres.length === 0) return ""
    return ` Con esta API key puedes usar, entre otros: ${nombres.join(", ")}. Ponlo en GEMINI_MODEL.`
  } catch {
    return ""
  }
}

/** El texto vive en `candidates[0].content.parts[*].text`; puede venir troceado. */
function extraerTexto(json: any): string | null {
  const partes = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(partes)) return null
  const texto = partes
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim()
  return texto || null
}
