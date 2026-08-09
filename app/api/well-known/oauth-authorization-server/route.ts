import { NextResponse } from "next/server"
import { RUTAS, SCOPES_SOPORTADOS, origenDe } from "@/lib/oauth/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Metadatos del servidor de autorización (RFC 8414).
 *
 * Se sirve en `/.well-known/oauth-authorization-server` mediante un rewrite
 * (ver `next.config.mjs`): el enrutador de Next ignora las carpetas que empiezan
 * por punto, así que la ruta real vive bajo `/api/well-known/`.
 *
 * Es lo primero que pide un cliente MCP —Claude incluido— al añadir el
 * conector: de aquí saca a dónde mandar al usuario a autorizar y dónde canjear
 * el código por un token. Público y sin secretos.
 */
export async function GET(request: Request) {
  const origen = origenDe(request)

  return NextResponse.json(
    {
      issuer: origen,
      authorization_endpoint: `${origen}${RUTAS.autorizar}`,
      token_endpoint: `${origen}${RUTAS.token}`,
      registration_endpoint: `${origen}${RUTAS.registro}`,
      revocation_endpoint: `${origen}${RUTAS.revocar}`,

      scopes_supported: [...SCOPES_SOPORTADOS],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],

      // OAuth 2.1: PKCE obligatorio y solo S256. No hay secreto de cliente
      // porque los clientes son aplicaciones públicas (no pueden guardarlo).
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],

      service_documentation: `${origen}/docs/api`,
      ui_locales_supported: ["es"],
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
