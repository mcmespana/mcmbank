export const runtime = "nodejs"

/**
 * GET /llms.txt
 *
 * Punto de entrada para agentes de IA (convención llms.txt). Markdown plano,
 * público, que describe la API externa y enlaza a la spec OpenAPI y a la
 * documentación interactiva, con URLs absolutas al dominio actual.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const body = `# MCM Bank — API externa

> API de solo lectura para consultar movimientos (transacciones) de MCM Bank
> desde aplicaciones internas como Google Apps Script. El ID de un movimiento es
> único en toda la base de datos: no hace falta indicar la delegación.

## Autenticación

Todas las peticiones requieren una clave de API en una cabecera:

- \`Authorization: Bearer <clave>\`  — o bien
- \`x-api-key: <clave>\`

La clave la configura el administrador del servidor (variable de entorno
\`MCM_API_KEY\`, con respaldo en \`CRON_SECRET\`).

## Recursos

- Especificación OpenAPI 3.1 (fuente de verdad legible por máquinas): ${origin}/api/v1/openapi.json
- Documentación interactiva (Scalar): ${origin}/docs/api

## Endpoints

### GET ${origin}/api/v1/movimientos/{id}
Devuelve un movimiento por su ID con sus relaciones (cuenta, categoría,
delegación, contacto) y la lista de archivos adjuntos embebida.

### GET ${origin}/api/v1/movimientos/{id}/archivos
Devuelve únicamente los archivos adjuntos del movimiento, con su URL pública de
descarga directa (la descarga del fichero no requiere autenticación).

## Ejemplo

\`\`\`bash
curl -H "x-api-key: TU_CLAVE" \\
  ${origin}/api/v1/movimientos/00000000-0000-0000-0000-000000000000
\`\`\`

## Notas

- El campo \`importe\` es positivo para ingresos y negativo para gastos; \`tipo\`
  ('ingreso' | 'gasto') refleja ese signo.
- Códigos de error: 400 (falta ID), 401 (clave inválida), 404 (no existe),
  500 (error de servidor o API no configurada).
- Formato de error: \`{ "ok": false, "error": "..." }\`.
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
