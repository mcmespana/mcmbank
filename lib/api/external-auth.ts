import { timingSafeEqual } from "node:crypto"

/**
 * Autenticación para la API externa y el servidor MCP (consumo desde Google
 * Apps Script, Claude u otras aplicaciones internas).
 *
 * Estrategia deliberadamente simple: claves secretas compartidas que se envían
 * en cada petición. Se aceptan dos formatos para comodidad del cliente:
 *
 *   - Cabecera `Authorization: Bearer <clave>`
 *   - Cabecera `x-api-key: <clave>`
 *
 * Hay dos niveles de permiso, para que una clave pegada en una hoja de cálculo
 * no pueda además escribir en la base de datos:
 *
 *   | Variable de entorno   | Permiso        |
 *   |-----------------------|----------------|
 *   | `MCM_API_KEY`         | lectura + escritura |
 *   | `MCM_API_KEY_READONLY`| solo lectura   |
 *   | `CRON_SECRET`         | solo lectura (respaldo histórico) |
 *
 * `CRON_SECRET` existe desde antes (cron de sincronización bancaria) y se
 * mantiene como respaldo para no romper integraciones ya montadas, pero **nunca
 * concede escritura**: para escribir hay que definir `MCM_API_KEY`.
 */

/** Permiso requerido por un endpoint. */
export type ApiScope = "read" | "write"

interface ConfiguredKey {
  value: string
  scope: ApiScope
  /** Nombre de la variable de entorno, solo para trazas y mensajes de error. */
  source: string
}

/**
 * Claves configuradas en el servidor, de mayor a menor permiso. Se lee en cada
 * llamada (no se cachea) para que un cambio de variable de entorno tras un
 * redeploy tenga efecto sin estado residual.
 */
function getConfiguredKeys(): ConfiguredKey[] {
  const keys: ConfiguredKey[] = []
  if (process.env.MCM_API_KEY) {
    keys.push({ value: process.env.MCM_API_KEY, scope: "write", source: "MCM_API_KEY" })
  }
  if (process.env.MCM_API_KEY_READONLY) {
    keys.push({
      value: process.env.MCM_API_KEY_READONLY,
      scope: "read",
      source: "MCM_API_KEY_READONLY",
    })
  }
  if (process.env.CRON_SECRET) {
    keys.push({ value: process.env.CRON_SECRET, scope: "read", source: "CRON_SECRET" })
  }
  return keys
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

/**
 * Compara dos cadenas en tiempo constante para no filtrar cuántos caracteres
 * iniciales coinciden. `timingSafeEqual` exige buffers del mismo tamaño, así
 * que la diferencia de longitud se comprueba aparte (la longitud de la clave
 * no es el secreto; su contenido sí).
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export type ApiAuthResult =
  | { ok: true; scope: ApiScope; source: string }
  | { ok: false; status: 401 | 403 | 500; error: string }

/**
 * Verifica que la petición incluya una clave de API válida con permiso
 * suficiente.
 *
 * - 500 si el servidor no tiene ninguna clave configurada (mala configuración).
 * - 401 si falta la clave o no coincide con ninguna.
 * - 403 si la clave es válida pero solo de lectura y el endpoint escribe.
 * - `{ ok: true, scope }` si la autenticación es correcta.
 *
 * @param required Permiso que exige el endpoint (por defecto `"read"`, para que
 *   los endpoints de consulta ya existentes sigan llamando `verifyApiKey(req)`).
 */
export function verifyApiKey(request: Request, required: ApiScope = "read"): ApiAuthResult {
  const configuredKeys = getConfiguredKeys()
  if (configuredKeys.length === 0) {
    return {
      ok: false,
      status: 500,
      error:
        "La API externa no está configurada en el servidor (falta MCM_API_KEY o CRON_SECRET).",
    }
  }

  const providedKey = extractRequestKey(request)
  if (!providedKey) {
    return {
      ok: false,
      status: 401,
      error:
        "No autorizado. Envía la clave en 'Authorization: Bearer <clave>' o en la cabecera 'x-api-key'.",
    }
  }

  // Se comparan todas las claves (sin cortocircuito) para no filtrar por tiempo
  // cuál de ellas coincidió.
  let matched: ConfiguredKey | null = null
  for (const key of configuredKeys) {
    if (timingSafeEqualString(providedKey, key.value) && !matched) {
      matched = key
    }
  }

  if (!matched) {
    return {
      ok: false,
      status: 401,
      error:
        "No autorizado. Envía la clave en 'Authorization: Bearer <clave>' o en la cabecera 'x-api-key'.",
    }
  }

  if (required === "write" && matched.scope !== "write") {
    const pista =
      matched.source === "MCM_API_KEY_READONLY"
        ? "Esa clave es de solo lectura; usa la de MCM_API_KEY para escribir."
        : "Estás usando CRON_SECRET, que solo da lectura. Define MCM_API_KEY y usa esa clave para escribir."
    return { ok: false, status: 403, error: `Esta operación modifica datos. ${pista}` }
  }

  return { ok: true, scope: matched.scope, source: matched.source }
}
