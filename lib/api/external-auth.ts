/**
 * Autenticación para la API externa (consumo desde Google Apps Script u otras
 * aplicaciones internas).
 *
 * Estrategia deliberadamente simple: una clave secreta compartida que se envía
 * en cada petición. Se acepta en dos formatos para comodidad del cliente:
 *
 *   - Cabecera `Authorization: Bearer <clave>`
 *   - Cabecera `x-api-key: <clave>`
 *
 * La clave válida se lee de las variables de entorno. Se admite una variable
 * dedicada `MCM_API_KEY` y, como respaldo, se reutiliza `CRON_SECRET` (que ya
 * existe para el cron de sincronización bancaria). Esto permite empezar sin
 * añadir variables nuevas y, más adelante, separar las claves si interesa.
 */

/**
 * Devuelve la clave de API configurada, o `null` si no hay ninguna.
 * El orden de preferencia es: `MCM_API_KEY` y luego `CRON_SECRET`.
 */
function getConfiguredApiKey(): string | null {
  return process.env.MCM_API_KEY || process.env.CRON_SECRET || null
}

/**
 * Extrae la clave enviada por el cliente desde las cabeceras de la petición.
 */
function extractRequestKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }
  const apiKeyHeader = request.headers.get("x-api-key")
  if (apiKeyHeader) {
    return apiKeyHeader.trim()
  }
  return null
}

export type ApiAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string }

/**
 * Verifica que la petición incluya una clave de API válida.
 *
 * - 500 si el servidor no tiene ninguna clave configurada (mala configuración).
 * - 401 si falta la clave o no coincide.
 * - `{ ok: true }` si la autenticación es correcta.
 */
export function verifyApiKey(request: Request): ApiAuthResult {
  const configuredKey = getConfiguredApiKey()
  if (!configuredKey) {
    return {
      ok: false,
      status: 500,
      error:
        "La API externa no está configurada en el servidor (falta MCM_API_KEY o CRON_SECRET).",
    }
  }

  const providedKey = extractRequestKey(request)
  if (!providedKey || providedKey !== configuredKey) {
    return {
      ok: false,
      status: 401,
      error:
        "No autorizado. Envía la clave en 'Authorization: Bearer <clave>' o en la cabecera 'x-api-key'.",
    }
  }

  return { ok: true }
}
