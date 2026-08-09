/**
 * Capa JSON-RPC 2.0 del servidor MCP.
 *
 * MCM Bank expone su servidor MCP como un endpoint HTTP sin estado
 * (transporte "Streamable HTTP"): cada petición POST lleva un mensaje JSON-RPC
 * y se responde con `application/json`. No hace falta sesión ni SSE porque el
 * servidor solo ofrece herramientas —no envía notificaciones al cliente por su
 * cuenta—, y sin estado funciona igual de bien en una función serverless que se
 * apaga entre llamadas.
 *
 * Se implementa a mano en lugar de con el SDK oficial para no añadir una
 * dependencia (ni su adaptador a Next.js) por unas 150 líneas de protocolo.
 */

export const PROTOCOLOS_SOPORTADOS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const
export const PROTOCOLO_POR_DEFECTO = "2025-06-18"

/** Códigos de error estándar de JSON-RPC. */
export const JSONRPC_ERRORES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

export type JsonRpcId = string | number | null

export interface JsonRpcRequest {
  jsonrpc: "2.0"
  id?: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: JsonRpcId
  result: unknown
}

export interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: JsonRpcId
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export function exito(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result }
}

export function fallo(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } }
}

/** Un mensaje sin `id` es una notificación: no se responde. */
export function esNotificacion(mensaje: JsonRpcRequest): boolean {
  return mensaje.id === undefined
}

export function negociarProtocolo(solicitado: unknown): string {
  if (typeof solicitado === "string" && (PROTOCOLOS_SOPORTADOS as readonly string[]).includes(solicitado)) {
    return solicitado
  }
  return PROTOCOLO_POR_DEFECTO
}
