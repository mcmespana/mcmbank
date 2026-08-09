import { NextResponse } from "next/server"
import { verifyApiKey } from "@/lib/api/external-auth"
import { JSONRPC_ERRORES, fallo, type JsonRpcRequest } from "@/lib/mcp/protocol"
import { procesarMensaje, SERVIDOR } from "@/lib/mcp/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Servidor MCP de MCM Bank (transporte Streamable HTTP, sin estado).
 *
 *   POST /api/mcp   →  mensajes JSON-RPC del protocolo MCP
 *
 * Autenticación: la misma clave que la API externa, en `Authorization: Bearer`
 * o en `x-api-key`. Una clave de solo lectura puede consultar pero no escribir.
 *
 * Autoría de las escrituras: se puede fijar por conexión con las cabeceras
 * `x-mcm-usuario-email` o `x-mcm-usuario-id`, o por llamada con el argumento
 * `usuario_email` de cada herramienta. Si no llega ninguna, se usa la cuenta
 * configurada en el servidor (`MCM_API_USER_EMAIL` / `MCM_API_USER_ID`).
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
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CABECERAS_CORS })
}

export async function POST(request: Request) {
  const auth = verifyApiKey(request)
  if (!auth.ok) {
    return NextResponse.json(
      fallo(null, JSONRPC_ERRORES.INVALID_REQUEST, auth.error),
      {
        status: auth.status,
        headers: {
          ...CABECERAS_CORS,
          ...(auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="MCM Bank MCP"' } : {}),
        },
      },
    )
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
  const opciones = {
    scope: auth.scope,
    baseUrl: `${url.protocol}//${url.host}`,
    actorHint: {
      usuario_email: request.headers.get("x-mcm-usuario-email"),
      usuario_id: request.headers.get("x-mcm-usuario-id"),
    },
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
