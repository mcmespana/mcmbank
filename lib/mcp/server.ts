import { createAdminClient } from "@/lib/supabase/admin"
import type { ApiScope } from "@/lib/api/external-auth"
import { toErrorPayload } from "@/lib/api/errors"
import type { ActorHint } from "@/lib/api/actor"
import {
  HERRAMIENTAS_POR_NOMBRE,
  definicionesDeHerramientas,
  permisoDe,
  type ContextoMcp,
} from "@/lib/mcp/tools"
import {
  JSONRPC_ERRORES,
  exito,
  fallo,
  negociarProtocolo,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "@/lib/mcp/protocol"

export const SERVIDOR = {
  name: "mcm-bank",
  title: "MCM Bank",
  version: "1.0.0",
}

/**
 * Instrucciones que el servidor entrega al cliente en `initialize`. Es el
 * "manual de uso" que lee el modelo antes de decidir qué herramienta llamar, y
 * el sitio donde se explican las convenciones que no caben en cada esquema.
 */
export const INSTRUCCIONES = `MCM Bank es la aplicación de tesorería del Movimiento Consolación para el Mundo.
Está organizada en delegaciones; cada delegación tiene cuentas, movimientos bancarios,
facturas y un canal de avisos con la oficina técnica.

Quien usa este servidor es un administrador de la oficina técnica que revisa TODAS las
delegaciones, así que casi todas las herramientas trabajan sobre varias delegaciones a la vez:
si omites el parámetro 'delegaciones', se buscan todas.

Convenciones que conviene tener claras:

- Las delegaciones, categorías y cuentas se indican por su nombre normal ("Sevilla",
  "Alimentación"), no hace falta el id. Si el nombre es ambiguo, el error te devuelve los
  candidatos para que reintentes con el correcto.
- Los importes de los movimientos llevan signo: los gastos son NEGATIVOS y los ingresos
  positivos. Los filtros por importe usan el valor absoluto; usa 'tipo' para quedarte con
  gastos o con ingresos. Para "los mayores gastos", ordena por importe_asc.
- Las facturas llevan siempre importe positivo. Una factura puede tener varios movimientos
  vinculados (pago en plazos) y un movimiento como mucho una factura.
- Antes de conciliar en bloque, usa 'conciliar_facturas' sin 'aplicar' para ver las
  propuestas, enséñaselas a la persona y solo después vuelve a llamar con aplicar=true.
- Las escrituras quedan firmadas por un usuario real de MCM Bank. Puedes indicar
  'usuario_email' en cada llamada para firmar con la cuenta de quien te está hablando.
- Antes de borrar cualquier cosa, pregunta. No hay papelera.`

export interface OpcionesMcp {
  scope: ApiScope
  baseUrl: string
  actorHint: ActorHint
}

/** Procesa un mensaje JSON-RPC. Devuelve `null` si era una notificación. */
export async function procesarMensaje(
  mensaje: JsonRpcRequest,
  opciones: OpcionesMcp,
): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = mensaje.id ?? null
  const esNotificacion = mensaje.id === undefined

  if (mensaje.jsonrpc !== "2.0" || typeof mensaje.method !== "string") {
    return esNotificacion
      ? null
      : fallo(id, JSONRPC_ERRORES.INVALID_REQUEST, "Mensaje JSON-RPC 2.0 mal formado.")
  }

  const params = (mensaje.params ?? {}) as Record<string, unknown>

  switch (mensaje.method) {
    case "initialize":
      return exito(id, {
        protocolVersion: negociarProtocolo(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVIDOR,
        instructions: INSTRUCCIONES,
      })

    // El cliente avisa de que ya está listo; no hay nada que hacer.
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null

    case "ping":
      return exito(id, {})

    case "logging/setLevel":
      return exito(id, {})

    case "tools/list":
      return exito(id, { tools: definicionesDeHerramientas() })

    // El servidor no ofrece recursos ni prompts, pero algunos clientes los
    // piden igualmente al conectar: se responde con listas vacías en vez de
    // con un error que asuste en los registros.
    case "resources/list":
      return exito(id, { resources: [] })
    case "resources/templates/list":
      return exito(id, { resourceTemplates: [] })
    case "prompts/list":
      return exito(id, { prompts: [] })

    case "tools/call":
      return exito(id, await ejecutarHerramienta(params, opciones))

    default:
      return esNotificacion
        ? null
        : fallo(id, JSONRPC_ERRORES.METHOD_NOT_FOUND, `Método '${mensaje.method}' no soportado.`)
  }
}

/**
 * Ejecuta una herramienta y devuelve el resultado en el formato de `tools/call`.
 *
 * Los fallos se devuelven como `isError: true` con el mensaje en el contenido,
 * no como error de JSON-RPC: así el modelo los lee, entiende qué ha fallado y
 * puede corregirse solo (indicar la delegación exacta, usar una categoría que
 * exista…) en lugar de ver la llamada rota sin explicación.
 */
async function ejecutarHerramienta(
  params: Record<string, unknown>,
  opciones: OpcionesMcp,
): Promise<Record<string, unknown>> {
  const nombre = typeof params.name === "string" ? params.name : ""
  const args = (params.arguments ?? {}) as Record<string, unknown>

  const herramienta = HERRAMIENTAS_POR_NOMBRE.get(nombre)
  if (!herramienta) {
    return resultadoError(
      `No existe la herramienta '${nombre}'.`,
      { herramientas: [...HERRAMIENTAS_POR_NOMBRE.keys()] },
    )
  }

  const requerido = permisoDe(herramienta, args)
  if (requerido === "write" && opciones.scope !== "write") {
    return resultadoError(
      `'${nombre}' modifica datos y la clave con la que te has conectado es de solo lectura. ` +
        "Pídele a quien administra MCM Bank una clave con permiso de escritura (MCM_API_KEY).",
    )
  }

  try {
    // Dentro del try: si el servidor está mal configurado, `createAdminClient`
    // lanza, y eso debe llegar al cliente como un error de la herramienta y no
    // como una petición rota sin explicación.
    const contexto: ContextoMcp = {
      admin: createAdminClient(),
      scope: opciones.scope,
      baseUrl: opciones.baseUrl,
      actorHint: opciones.actorHint,
    }

    const resultado = await herramienta.handler(args, contexto)
    return {
      content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
    }
  } catch (err) {
    const { body } = toErrorPayload(err)
    return resultadoError(body.error, body.detalles)
  }
}

function resultadoError(mensaje: string, detalles?: unknown): Record<string, unknown> {
  const cuerpo = detalles ? { error: mensaje, detalles } : { error: mensaje }
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(cuerpo, null, 2) }],
  }
}
