import { NextResponse } from "next/server"
import { JSONRPC_ERRORES, fallo, type JsonRpcRequest } from "@/lib/mcp/protocol"
import { autorizarMcp } from "@/lib/mcp/auth"
import { procesarMensaje, SERVIDOR } from "@/lib/mcp/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Servidor MCP de MCM Bank (transporte Streamable HTTP, sin estado).
 *
 *   POST /api/mcp   →  mensajes JSON-RPC del protocolo MCP
 *
 * Dos formas de autenticarse (ver `lib/mcp/auth.ts`):
 *
 *   - **OAuth**, para el conector de claude.ai: cada persona entra con su
 *     cuenta de MCM Bank y las escrituras se firman con ella. Cuando falta el
 *     token se responde 401 con `WWW-Authenticate`, que es la señal con la que
 *     el cliente descubre el servidor de autorización y arranca el flujo solo.
 *   - **Clave de API** en `Authorization: Bearer` o `x-api-key`, para Claude
 *     Code y los scripts.
 *
 * Para conectarlo desde Claude Code:
 *   claude mcp add --transport http mcm-bank https://TU-DOMINIO/api/mcp \
 *     --header "Authorization: Bearer TU_CLAVE"
 */

const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, mcp-session-id, mcp-protocol-version, x-mcm-usuario-email, x-mcm-usuario-id",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CABECERAS_CORS })
}

export async function POST(request: Request) {
  const autorizacion = await autorizarMcp(request)
  if (!autorizacion.ok) {
    const { status, error, cabeceras } = autorizacion.rechazo
    return NextResponse.json(fallo(null, JSONRPC_ERRORES.INVALID_REQUEST, error), {
      status,
      headers: { ...CABECERAS_CORS, ...cabeceras },
    })
  }

  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json(
      fallo(null, JSONRPC_ERRORES.PARSE_ERROR, "El cuerpo de la petición no es JSON válido."),
      { status: 400, headers: CABECERAS_CORS },
    )
  }

  const url = new URL(request.url)
  const { scope, actorHint, actorForzado } = autorizacion.auth
  const opciones = {
    scope,
    baseUrl: `${url.protocol}//${url.host}`,
    actorHint,
    actorForzado,
  }

  // Los lotes desaparecieron de la especificación en 2025-06-18, pero clientes
  // antiguos los siguen enviando y cuestan cuatro líneas de soporte.
  const mensajes = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
  const respuestas = []
  for (const mensaje of mensajes) {
    const respuesta = await procesarMensaje(mensaje as JsonRpcRequest, opciones)
    if (respuesta) respuestas.push(respuesta)
  }

  // Solo había notificaciones: el protocolo pide 202 sin cuerpo.
  if (respuestas.length === 0) {
    return new Response(null, { status: 202, headers: CABECERAS_CORS })
  }

  const payload = Array.isArray(cuerpo) ? respuestas : respuestas[0]
  return NextResponse.json(payload, {
    headers: { ...CABECERAS_CORS, "mcp-protocol-version": "2025-06-18" },
  })
}

/**
 * El transporte Streamable HTTP usa GET para abrir un canal SSE en el que el
 * servidor empuja mensajes por su cuenta. Este servidor solo responde a lo que
 * se le pregunta, así que no lo necesita: se responde 405, que es justo lo que
 * la especificación dice que haga un servidor sin ese canal.
 */
export async function GET() {
  return NextResponse.json(
    fallo(
      null,
      JSONRPC_ERRORES.METHOD_NOT_FOUND,
      `${SERVIDOR.title} no ofrece canal SSE: envía los mensajes JSON-RPC por POST a esta misma URL.`,
    ),
    { status: 405, headers: { ...CABECERAS_CORS, Allow: "POST, OPTIONS" } },
  )
}

/** Cierre de sesión: este servidor no guarda ninguna, así que siempre va bien. */
export async function DELETE() {
  return new Response(null, { status: 204, headers: CABECERAS_CORS })
}
