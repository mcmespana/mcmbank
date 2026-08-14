export const runtime = "nodejs"

/**
 * GET /llms.txt
 *
 * Punto de entrada para agentes de IA (convención llms.txt). Markdown plano,
 * público, que describe la API externa y el servidor MCP y enlaza a la spec
 * OpenAPI y a la documentación interactiva, con URLs absolutas al dominio
 * actual.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const body = `# MCM Bank — API externa y servidor MCP

> MCM Bank es la aplicación de tesorería del Movimiento Consolación para el Mundo,
> organizada en delegaciones. Esta API está pensada para la oficina técnica, que
> revisa TODAS las delegaciones a la vez: movimientos bancarios, facturas y su
> conciliación, avisos y tareas, y archivos adjuntos.

## Dos formas de usarla

- **API REST** en \`${origin}/api/v1\` — para scripts, Google Apps Script, integraciones.
- **Servidor MCP** en \`${origin}/api/mcp\` — para hablarle en lenguaje natural desde Claude.

## Autenticación

El servidor MCP admite **OAuth 2.1** (registro dinámico de clientes + PKCE): es lo que
usan los conectores de claude.ai, y no necesita ninguna clave. El descubrimiento
empieza en \`${origin}/.well-known/oauth-protected-resource\`.

Para la API REST (y para el MCP desde Claude Code) se usa una clave en una cabecera:

- \`Authorization: Bearer <clave>\`  — o bien
- \`x-api-key: <clave>\`

Hay dos niveles: \`MCM_API_KEY\` da lectura y escritura; \`MCM_API_KEY_READONLY\`
(y el histórico \`CRON_SECRET\`) solo lectura.

## Recursos

- Especificación OpenAPI 3.1 (fuente de verdad legible por máquinas): ${origin}/api/v1/openapi.json
- Documentación interactiva (Scalar): ${origin}/docs/api
- Servidor MCP (JSON-RPC sobre HTTP, POST): ${origin}/api/mcp

## Conexión MCP desde Claude Code

\`\`\`bash
claude mcp add --transport http mcm-bank ${origin}/api/mcp \\
  --header "Authorization: Bearer TU_CLAVE"
\`\`\`

Desde claude.ai basta con añadir \`${origin}/api/mcp\` como conector personalizado:
el servidor responde 401 con \`WWW-Authenticate\` y el cliente arranca el flujo de OAuth solo.

Herramientas disponibles: buscar_movimientos, obtener_movimiento,
actualizar_movimiento, resumen_economico, listar_delegaciones, listar_cuentas,
listar_categorias, listar_contactos, buscar_facturas, obtener_factura,
crear_factura, actualizar_factura, eliminar_factura, vincular_factura,
desvincular_factura, buscar_movimiento_de_factura, buscar_factura_de_movimiento,
conciliar_facturas, leer_factura_con_ia, aceptar_categoria_factura,
subir_archivo, obtener_url_archivo, eliminar_archivo,
listar_avisos, crear_aviso, actualizar_aviso, eliminar_aviso, notificar_aviso,
listar_pagos_mcm.

## Endpoints REST principales

### GET ${origin}/api/v1/movimientos
Busca movimientos en una, varias o todas las delegaciones y devuelve además el
resumen económico del conjunto completo. Filtros: \`texto\`, \`delegaciones\`,
\`tipo\` (ingreso|gasto), \`importe_min\`, \`importe_max\`, \`fecha_desde\`,
\`fecha_hasta\`, \`categorias\`, \`cuentas\`, \`sin_categoria\`, \`con_factura\`,
\`factura_pendiente\`, \`orden\`, \`limite\`, \`offset\`.

### GET / PATCH ${origin}/api/v1/movimientos/{id}
Movimiento completo con relaciones y archivos; PATCH edita categoría, contacto,
notas, descripción, contraparte, método, \`ignorado\` y \`factura_pendiente\`.

### GET / POST ${origin}/api/v1/movimientos/{id}/archivos
Lista los adjuntos, o sube uno nuevo en base64. Al subir una factura se registra
también en la sección Facturas, ya conciliada con el movimiento.

### GET / POST ${origin}/api/v1/facturas
Bandeja de facturas con lo pagado y lo pendiente de cada una; POST registra una
nueva (opcionalmente con su archivo y ya vinculada a un movimiento).

### POST ${origin}/api/v1/facturas/{id}/vincular
Concilia una factura con el movimiento que la pagó.

### POST ${origin}/api/v1/facturas/{id}/leer-ia
Lee el documento de la factura con IA y rellena los campos vacíos (proveedor
—creándolo si hace falta—, número, fecha, importe y concepto). La categoría se
devuelve solo como sugerencia en \`datos_ia\`.

### POST ${origin}/api/v1/facturas/{id}/categoria
Aplica la categoría: la sugerida por la IA o la que se indique. Existe como paso
aparte porque la lectura automática nunca categoriza por su cuenta.

### POST ${origin}/api/v1/conciliacion
Cuadra un lote de facturas: se envía una lista de importes y devuelve, para cada
uno, los movimientos que mejor encajan. Con \`aplicar: true\` vincula los casos
claros.

### GET / POST ${origin}/api/v1/avisos
Notas y tareas entre la oficina técnica y los tesoreros de cada delegación.
POST admite \`notificar: true\` para enviarlo además por correo.

### GET ${origin}/api/v1/resumen
Ingresos, gastos, neto y saldo por delegación, con desglose por categoría.

### GET ${origin}/api/v1/delegaciones · /cuentas · /categorias · /contactos · /pagos-mcm
Catálogos de referencia.

### GET ${origin}/api/v1/archivos/{id}/descargar
Redirige a una URL firmada del fichero.

## Ejemplo

\`\`\`bash
curl -H "x-api-key: TU_CLAVE" \\
  "${origin}/api/v1/movimientos?texto=mercadona&tipo=gasto&importe_min=50"
\`\`\`

## Notas

- Donde se pide una delegación, categoría o cuenta se admite su nombre normal
  ("Sevilla", "Alimentación"), su código o su UUID. Si el nombre es ambiguo, el
  error 400 devuelve los candidatos.
- El campo \`importe\` de un movimiento es positivo en los ingresos y negativo en
  los gastos; \`tipo\` refleja ese signo. El importe de una factura es siempre
  positivo. Los filtros por importe usan el valor absoluto.
- Una factura puede tener varios movimientos vinculados (pago en plazos); un
  movimiento, como mucho una factura.
- Las escrituras se firman con un usuario real: \`usuario_email\` en el cuerpo,
  la cabecera \`x-mcm-usuario-email\`, o \`MCM_API_USER_EMAIL\` en el servidor.
- Códigos de error: 400 (petición mal formada), 401 (clave inválida), 403 (clave
  de solo lectura en una operación de escritura), 404 (no existe), 409
  (conflicto), 500 (error de servidor o API sin configurar).
- Formato de error: \`{ "ok": false, "error": "...", "detalles": { ... } }\`.
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
