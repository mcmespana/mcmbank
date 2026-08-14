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
 * Schema y el modelo está obligado a responder con un JSON que encaje. Nunca se
 * le dan herramientas ni se ejecuta nada de lo que responde: el documento que
 * lee es contenido no confiable (llega por correo desde fuera), así que la
 * única salida posible es rellenar los campos del schema, que luego se validan
 * uno a uno en el llamador.
 */

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const TIMEOUT_MS = 60_000

export const GEMINI_MODELO_POR_DEFECTO = "gemini-3.7-flash"

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
      responseSchema: peticion.schema,
      thinkingConfig: {
        thinkingLevel:
          peticion.nivelRazonamiento || process.env.GEMINI_THINKING_LEVEL?.trim() || "low",
      },
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
      const detalle = (await respuesta.text().catch(() => "")).slice(0, 500)
      // La clave y la cuota son problemas de configuración: no se reintentan.
      if (respuesta.status === 400 || respuesta.status === 401 || respuesta.status === 403) {
        console.error("Gemini rechazó la petición:", respuesta.status, detalle)
        throw new ApiError(
          502,
          `Gemini rechazó la petición (${respuesta.status}). Revisa GEMINI_API_KEY y que el modelo '${modelo}' exista.`,
        )
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
