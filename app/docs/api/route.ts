export const runtime = "nodejs"

/**
 * GET /docs/api
 *
 * Página de documentación interactiva de la API externa, renderizada con
 * Scalar (cargado desde CDN). Apunta a la spec OpenAPI servida en
 * /api/v1/openapi.json. Pública.
 *
 * Se devuelve como HTML directo (route handler) en lugar de página React para
 * evitar conflictos de hidratación y de estilos globales con el widget de
 * Scalar, que ocupa toda la página.
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MCM Bank · API externa</title>
    <link rel="icon" href="/favicon.ico" />
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/api/v1/openapi.json',
        theme: 'default',
        metaData: {
          title: 'MCM Bank · API externa',
        },
      })
    </script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
