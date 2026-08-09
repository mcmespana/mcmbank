import { NextResponse } from "next/server"
import { RUTAS, SCOPES_SOPORTADOS, origenDe, urlRecurso } from "@/lib/oauth/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Metadatos del recurso protegido (RFC 9728).
 *
 * Cuando el servidor MCP responde `401`, su cabecera `WWW-Authenticate` apunta
 * aquí. El cliente lee este documento para saber **qué servidor de
 * autorización** le da tokens válidos para este recurso, y solo entonces
 * arranca el baile de OAuth.
 *
 * Se sirve por rewrite en `/.well-known/oauth-protected-resource`, con y sin el
 * sufijo de la ruta del MCP (algunos clientes piden
 * `/.well-known/oauth-protected-resource/api/mcp`).
 */
export async function GET(request: Request) {
  const origen = origenDe(request)

  return NextResponse.json(
    {
      resource: urlRecurso(origen),
      authorization_servers: [origen],
      scopes_supported: [...SCOPES_SOPORTADOS],
      bearer_methods_supported: ["header"],
      resource_name: "MCM Bank",
      resource_documentation: `${origen}/docs/api`,
      authorization_server_metadata: `${origen}${RUTAS.metadatosServidor}`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcp-protocol-version",
    },
  })
}
