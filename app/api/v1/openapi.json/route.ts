import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * GET /api/v1/openapi.json
 *
 * Especificación OpenAPI 3.1 de la API externa. Es la "fuente de verdad"
 * legible por máquinas: la consumen tanto la página de documentación (Scalar)
 * como agentes de IA y generadores de clientes.
 *
 * Pública (no contiene secretos). El servidor se calcula a partir del origen de
 * la petición para que el "try it out" apunte al dominio correcto.
 */

const RESPUESTAS_ERROR = {
  "400": { $ref: "#/components/responses/Error" },
  "401": { $ref: "#/components/responses/Error" },
  "403": { $ref: "#/components/responses/Error" },
  "404": { $ref: "#/components/responses/Error" },
  "500": { $ref: "#/components/responses/Error" },
}

/** Envuelve un esquema en la forma `{ ok: true, ...datos }` de las respuestas. */
function respuestaOk(descripcion: string, propiedades: Record<string, unknown>) {
  return {
    "200": {
      description: descripcion,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { ok: { type: "boolean", const: true }, ...propiedades },
            required: ["ok"],
          },
        },
      },
    },
    ...RESPUESTAS_ERROR,
  }
}

const PARAM_DELEGACIONES = {
  name: "delegaciones",
  in: "query",
  description:
    "Delegaciones por nombre, código o id. Se admite repetir el parámetro o separarlo por comas. Si se omite, TODAS las delegaciones.",
  schema: { type: "string" },
  example: "Sevilla,Madrid",
}

const PARAM_ID = (que: string) => ({
  name: "id",
  in: "path",
  required: true,
  description: `Id (UUID) ${que}.`,
  schema: { type: "string", format: "uuid" },
})

const CUERPO_ARCHIVO = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ArchivoEntrante" },
    },
  },
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MCM Bank API externa",
      version: "2.0.0",
      description:
        "API de MCM Bank para aplicaciones internas y agentes de IA. Cubre movimientos, " +
        "facturas, conciliación, avisos y archivos de **todas las delegaciones** a la vez: " +
        "está pensada para la oficina técnica, que las revisa todas.\n\n" +
        "**Autenticación:** envía la clave en `Authorization: Bearer <clave>` o `x-api-key: <clave>`. " +
        "`MCM_API_KEY` da lectura y escritura; `MCM_API_KEY_READONLY` (y el histórico `CRON_SECRET`) " +
        "solo lectura.\n\n" +
        "**Delegaciones, categorías y cuentas por su nombre:** donde se pide una delegación puedes " +
        "escribir `Sevilla`, `MCM-SEV` o su UUID. Si el nombre es ambiguo, el error 400 devuelve los " +
        "candidatos.\n\n" +
        "**Signos:** el `importe` de un movimiento es negativo en los gastos y positivo en los " +
        "ingresos; el de una factura siempre positivo. Los filtros `importe_min`/`importe_max` " +
        "trabajan con el valor absoluto.\n\n" +
        "**Autoría de las escrituras:** cada escritura queda firmada por un usuario real. Se indica " +
        "con `usuario_email` en el cuerpo, con la cabecera `x-mcm-usuario-email`, o en el servidor con " +
        "`MCM_API_USER_EMAIL` / `MCM_API_USER_ID`.\n\n" +
        `**MCP:** este mismo backend expone un servidor MCP en \`${origin}/api/mcp\` para usarlo desde ` +
        "Claude en lenguaje natural.",
    },
    servers: [{ url: origin, description: "Servidor actual" }],
    tags: [
      { name: "Referencia", description: "Delegaciones, cuentas, categorías y contactos" },
      { name: "Movimientos", description: "Consulta y edición de movimientos y sus archivos" },
      { name: "Facturas", description: "Bandeja de facturas y conciliación con movimientos" },
      { name: "Avisos", description: "Notas y tareas entre la oficina técnica y las delegaciones" },
      { name: "Archivos", description: "Descarga y borrado de adjuntos" },
      { name: "Informes", description: "Resumen económico" },
    ],
    security: [{ apiKeyHeader: [] }, { bearerAuth: [] }],
    paths: {
      // ------------------------------------------------------------ Referencia
      "/api/v1/delegaciones": {
        get: {
          tags: ["Referencia"],
          summary: "Listar todas las delegaciones",
          operationId: "listarDelegaciones",
          responses: respuestaOk("Delegaciones de la organización.", {
            total: { type: "integer" },
            delegaciones: { type: "array", items: { $ref: "#/components/schemas/Delegacion" } },
          }),
        },
      },
      "/api/v1/cuentas": {
        get: {
          tags: ["Referencia"],
          summary: "Listar cuentas bancarias y cajas",
          operationId: "listarCuentas",
          parameters: [
            PARAM_DELEGACIONES,
            {
              name: "incluir_inactivas",
              in: "query",
              schema: { type: "boolean" },
              description: "Incluir cuentas desactivadas.",
            },
          ],
          responses: respuestaOk("Cuentas.", {
            total: { type: "integer" },
            cuentas: { type: "array", items: { type: "object" } },
          }),
        },
      },
      "/api/v1/categorias": {
        get: {
          tags: ["Referencia"],
          summary: "Listar categorías",
          description:
            "Categorías globales de MCM más las propias de cada delegación. Pidiendo una sola delegación se aplican además su orden y visibilidad personalizados.",
          operationId: "listarCategorias",
          parameters: [
            PARAM_DELEGACIONES,
            { name: "incluir_inactivas", in: "query", schema: { type: "boolean" } },
          ],
          responses: respuestaOk("Categorías.", {
            total: { type: "integer" },
            categorias: { type: "array", items: { type: "object" } },
          }),
        },
      },
      "/api/v1/contactos": {
        get: {
          tags: ["Referencia"],
          summary: "Listar proveedores y personas",
          operationId: "listarContactos",
          parameters: [
            PARAM_DELEGACIONES,
            { name: "texto", in: "query", schema: { type: "string" }, description: "Filtra por nombre." },
            { name: "tipos", in: "query", schema: { type: "string" }, example: "proveedor" },
            { name: "incluir_archivados", in: "query", schema: { type: "boolean" } },
          ],
          responses: respuestaOk("Contactos.", {
            total: { type: "integer" },
            contactos: { type: "array", items: { type: "object" } },
          }),
        },
      },

      // ----------------------------------------------------------- Movimientos
      "/api/v1/movimientos": {
        get: {
          tags: ["Movimientos"],
          summary: "Buscar movimientos en una, varias o todas las delegaciones",
          description:
            "Devuelve la página de resultados y, además, el resumen económico de **todo** el conjunto encontrado, desglosado por delegación.\n\n" +
            "Ejemplo — gastos de Mercadona de más de 50 € en cualquier delegación durante 2026:\n\n" +
            "`/api/v1/movimientos?texto=mercadona&tipo=gasto&importe_min=50&fecha_desde=2026-01-01&fecha_hasta=2026-12-31`",
          operationId: "buscarMovimientos",
          parameters: [
            {
              name: "texto",
              in: "query",
              schema: { type: "string" },
              description:
                "Busca en concepto, descripción, contraparte y notas. Con varias palabras, deben aparecer todas.",
            },
            PARAM_DELEGACIONES,
            {
              name: "tipo",
              in: "query",
              schema: { type: "string", enum: ["ingreso", "gasto"] },
              description: "Quedarse solo con ingresos o con gastos.",
            },
            {
              name: "importe_min",
              in: "query",
              schema: { type: "number" },
              description: "Importe mínimo en valor absoluto.",
            },
            { name: "importe_max", in: "query", schema: { type: "number" } },
            { name: "fecha_desde", in: "query", schema: { type: "string", format: "date" } },
            { name: "fecha_hasta", in: "query", schema: { type: "string", format: "date" } },
            {
              name: "categorias",
              in: "query",
              schema: { type: "string" },
              description: "Categorías por nombre o id, separadas por comas.",
            },
            { name: "sin_categoria", in: "query", schema: { type: "boolean" } },
            {
              name: "cuentas",
              in: "query",
              schema: { type: "string" },
              description: "Cuentas por nombre, IBAN o id.",
            },
            {
              name: "con_factura",
              in: "query",
              schema: { type: "boolean" },
              description: "true = solo con factura vinculada; false = solo sin ella.",
            },
            { name: "factura_pendiente", in: "query", schema: { type: "boolean" } },
            {
              name: "incluir_ignorados",
              in: "query",
              schema: { type: "boolean" },
              description: "Por defecto se excluyen, igual que en la aplicación.",
            },
            { name: "incluir_cuentas_inactivas", in: "query", schema: { type: "boolean" } },
            {
              name: "orden",
              in: "query",
              schema: {
                type: "string",
                enum: ["fecha_desc", "fecha_asc", "importe_desc", "importe_asc"],
              },
              description: "Los gastos son negativos: para los mayores gastos, importe_asc.",
            },
            {
              name: "limite",
              in: "query",
              schema: { type: "integer", default: 50, maximum: 200 },
            },
            { name: "offset", in: "query", schema: { type: "integer" } },
            { name: "incluir_archivos", in: "query", schema: { type: "boolean", default: true } },
          ],
          responses: respuestaOk("Movimientos encontrados y resumen del conjunto.", {
            total: { type: "integer", description: "Movimientos que cumplen los filtros." },
            limite: { type: "integer" },
            offset: { type: "integer" },
            hay_mas: { type: "boolean" },
            resumen: { $ref: "#/components/schemas/ResumenBusqueda" },
            movimientos: { type: "array", items: { $ref: "#/components/schemas/Movimiento" } },
          }),
        },
      },
      "/api/v1/movimientos/{id}": {
        get: {
          tags: ["Movimientos"],
          summary: "Obtener un movimiento por su ID (datos + archivos)",
          description:
            "El ID es único en toda la base de datos, así que no hace falta indicar la delegación.",
          operationId: "getMovimiento",
          parameters: [PARAM_ID("del movimiento")],
          responses: respuestaOk("Movimiento encontrado.", {
            movimiento: { $ref: "#/components/schemas/Movimiento" },
          }),
        },
        patch: {
          tags: ["Movimientos"],
          summary: "Editar un movimiento",
          description:
            "Solo campos editables por personas. Importe, fecha, cuenta y delegación no se tocan desde la API: vienen del banco.",
          operationId: "actualizarMovimiento",
          parameters: [PARAM_ID("del movimiento")],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    categoria_id: { type: ["string", "null"], format: "uuid" },
                    contacto_id: { type: ["string", "null"], format: "uuid" },
                    notas: { type: ["string", "null"] },
                    descripcion: { type: ["string", "null"] },
                    contraparte: { type: ["string", "null"] },
                    metodo: { type: ["string", "null"] },
                    ignorado: { type: "boolean" },
                    factura_pendiente: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: respuestaOk("Movimiento actualizado.", {
            movimiento: { $ref: "#/components/schemas/Movimiento" },
          }),
        },
      },
      "/api/v1/movimientos/{id}/archivos": {
        get: {
          tags: ["Movimientos"],
          summary: "Obtener solo los archivos de un movimiento",
          operationId: "getMovimientoArchivos",
          parameters: [PARAM_ID("del movimiento")],
          responses: respuestaOk("Archivos del movimiento.", {
            movimiento_id: { type: "string", format: "uuid" },
            total: { type: "integer" },
            archivos: { type: "array", items: { $ref: "#/components/schemas/Archivo" } },
          }),
        },
        post: {
          tags: ["Movimientos"],
          summary: "Adjuntar un archivo a un movimiento",
          description:
            "Sube el fichero en base64. Si va al bucket `facturas` (el predeterminado), también se registra en la sección Facturas ya conciliado con este movimiento, igual que al subirlo desde la aplicación.",
          operationId: "subirArchivoMovimiento",
          parameters: [PARAM_ID("del movimiento")],
          requestBody: CUERPO_ARCHIVO,
          responses: respuestaOk("Archivo subido.", {
            archivo: { $ref: "#/components/schemas/Archivo" },
            factura_id: { type: ["string", "null"], format: "uuid" },
            aviso: { type: "string", description: "Presente si algo secundario falló." },
          }),
        },
      },
      "/api/v1/movimientos/{id}/facturas-candidatas": {
        get: {
          tags: ["Facturas"],
          summary: "Facturas que podrían corresponder a este movimiento",
          description:
            "Compara contra el importe que a cada factura le queda por pagar, de modo que funciona también con pagos en varios plazos.",
          operationId: "facturasCandidatas",
          parameters: [PARAM_ID("del movimiento"), { name: "limite", in: "query", schema: { type: "integer" } }],
          responses: respuestaOk("Facturas candidatas ordenadas de mejor a peor.", {
            movimiento_id: { type: "string", format: "uuid" },
            total: { type: "integer" },
            candidatas: { type: "array", items: { type: "object" } },
          }),
        },
      },

      // -------------------------------------------------------------- Facturas
      "/api/v1/facturas": {
        get: {
          tags: ["Facturas"],
          summary: "Buscar facturas",
          operationId: "buscarFacturas",
          parameters: [
            PARAM_DELEGACIONES,
            {
              name: "estados",
              in: "query",
              schema: { type: "string" },
              description: "bandeja, sin_pagar, pagada_parcial, pagada, pagada_fuera.",
            },
            { name: "texto", in: "query", schema: { type: "string" } },
            { name: "numero", in: "query", schema: { type: "string" } },
            { name: "importe_min", in: "query", schema: { type: "number" } },
            { name: "importe_max", in: "query", schema: { type: "number" } },
            { name: "fecha_desde", in: "query", schema: { type: "string", format: "date" } },
            { name: "fecha_hasta", in: "query", schema: { type: "string", format: "date" } },
            {
              name: "sin_conciliar",
              in: "query",
              schema: { type: "boolean" },
              description: "Solo las que no tienen ningún movimiento vinculado.",
            },
            { name: "limite", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: respuestaOk("Facturas encontradas.", {
            total: { type: "integer" },
            limite: { type: "integer" },
            offset: { type: "integer" },
            hay_mas: { type: "boolean" },
            facturas: { type: "array", items: { $ref: "#/components/schemas/Factura" } },
          }),
        },
        post: {
          tags: ["Facturas"],
          summary: "Registrar una factura",
          description: "Admite subir el archivo y conciliarla con un movimiento en la misma llamada.",
          operationId: "crearFactura",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    delegacion: { type: "string", description: "Nombre, código o id." },
                    concepto: { type: "string" },
                    numero: { type: "string" },
                    importe: { type: "number", description: "En positivo." },
                    fecha_emision: { type: "string", format: "date" },
                    moneda: { type: "string", default: "EUR" },
                    estado: {
                      type: "string",
                      enum: ["bandeja", "sin_pagar", "pagada_parcial", "pagada", "pagada_fuera"],
                    },
                    notas: { type: "string" },
                    contacto_id: { type: "string", format: "uuid" },
                    movimiento_id: { type: "string", format: "uuid" },
                    archivo: { $ref: "#/components/schemas/ArchivoEntrante" },
                    usuario_email: { type: "string", format: "email" },
                  },
                  required: ["delegacion"],
                },
              },
            },
          },
          responses: respuestaOk("Factura creada.", {
            factura: { $ref: "#/components/schemas/Factura" },
          }),
        },
      },
      "/api/v1/facturas/{id}": {
        get: {
          tags: ["Facturas"],
          summary: "Obtener una factura",
          operationId: "getFactura",
          parameters: [PARAM_ID("de la factura")],
          responses: respuestaOk("Factura.", { factura: { $ref: "#/components/schemas/Factura" } }),
        },
        patch: {
          tags: ["Facturas"],
          summary: "Editar una factura",
          operationId: "actualizarFactura",
          parameters: [PARAM_ID("de la factura")],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    numero: { type: ["string", "null"] },
                    concepto: { type: ["string", "null"] },
                    importe: { type: ["number", "null"] },
                    fecha_emision: { type: ["string", "null"], format: "date" },
                    estado: { type: "string" },
                    notas: { type: ["string", "null"] },
                    contacto_id: { type: ["string", "null"], format: "uuid" },
                  },
                },
              },
            },
          },
          responses: respuestaOk("Factura actualizada.", {
            factura: { $ref: "#/components/schemas/Factura" },
          }),
        },
        delete: {
          tags: ["Facturas"],
          summary: "Borrar una factura",
          description:
            "Borra la factura y sus archivos y desvincula sus movimientos (los movimientos no se borran). Irreversible.",
          operationId: "eliminarFactura",
          parameters: [PARAM_ID("de la factura")],
          responses: respuestaOk("Factura eliminada.", {
            eliminada: { type: "boolean", const: true },
            id: { type: "string", format: "uuid" },
          }),
        },
      },
      "/api/v1/facturas/{id}/archivos": {
        get: {
          tags: ["Facturas"],
          summary: "Archivos de una factura",
          operationId: "getFacturaArchivos",
          parameters: [PARAM_ID("de la factura")],
          responses: respuestaOk("Archivos.", {
            factura_id: { type: "string", format: "uuid" },
            total: { type: "integer" },
            archivos: { type: "array", items: { $ref: "#/components/schemas/Archivo" } },
          }),
        },
        post: {
          tags: ["Facturas"],
          summary: "Adjuntar un archivo a una factura",
          description:
            "Si la factura ya está conciliada, el archivo se replica en sus movimientos para verse desde ambos lados.",
          operationId: "subirArchivoFactura",
          parameters: [PARAM_ID("de la factura")],
          requestBody: CUERPO_ARCHIVO,
          responses: respuestaOk("Archivo subido.", {
            archivo: { $ref: "#/components/schemas/Archivo" },
            factura_id: { type: "string", format: "uuid" },
          }),
        },
      },
      "/api/v1/facturas/{id}/vincular": {
        post: {
          tags: ["Facturas"],
          summary: "Conciliar una factura con un movimiento",
          description:
            "Una factura admite varios movimientos (pago en plazos); un movimiento, como mucho una factura. El estado de la factura lo recalcula la base de datos.",
          operationId: "vincularFactura",
          parameters: [PARAM_ID("de la factura")],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    movimiento_id: { type: "string", format: "uuid" },
                    usuario_email: { type: "string", format: "email" },
                  },
                  required: ["movimiento_id"],
                },
              },
            },
          },
          responses: respuestaOk("Factura conciliada.", {
            factura: { $ref: "#/components/schemas/Factura" },
          }),
        },
        delete: {
          tags: ["Facturas"],
          summary: "Deshacer una conciliación",
          operationId: "desvincularFactura",
          parameters: [
            PARAM_ID("de la factura"),
            {
              name: "movimiento_id",
              in: "query",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: respuestaOk("Vínculo deshecho.", {
            factura: { $ref: "#/components/schemas/Factura" },
          }),
        },
      },
      "/api/v1/conciliacion": {
        post: {
          tags: ["Facturas"],
          summary: "Cuadrar un lote de facturas contra los movimientos",
          description:
            "Recibe una lista de importes (con fecha, proveedor o número si se conocen) y devuelve, para cada uno, los movimientos que mejor encajan con su puntuación y motivos.\n\n" +
            "Por defecto solo propone (basta clave de lectura). Con `aplicar: true` —que exige clave de escritura— vincula los casos claros y deja los dudosos para revisión humana.",
          operationId: "conciliarLote",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    facturas: {
                      type: "array",
                      maxItems: 100,
                      items: {
                        type: "object",
                        properties: {
                          referencia: { type: "string", description: "Etiqueta libre para reconocer la línea." },
                          importe: { type: "number", description: "En positivo." },
                          fecha: { type: "string", format: "date" },
                          proveedor: { type: "string" },
                          numero: { type: "string" },
                          delegacion: { type: "string" },
                          factura_id: { type: "string", format: "uuid" },
                        },
                        required: ["importe"],
                      },
                    },
                    delegaciones: { type: "array", items: { type: "string" } },
                    ventana_dias: { type: "integer", default: 90 },
                    max_candidatos: { type: "integer", default: 5 },
                    aplicar: { type: "boolean", default: false },
                    crear_facturas: { type: "boolean", default: false },
                    usuario_email: { type: "string", format: "email" },
                  },
                  required: ["facturas"],
                },
                example: {
                  facturas: [
                    { referencia: "linea-1", importe: 128.4, fecha: "2026-03-04", proveedor: "Mercadona" },
                    { referencia: "linea-2", importe: 56.9, proveedor: "Endesa" },
                  ],
                  delegaciones: ["Sevilla"],
                },
              },
            },
          },
          responses: respuestaOk("Propuestas de conciliación.", {
            total: { type: "integer" },
            con_match_directo: { type: "integer" },
            sin_candidatos: { type: "integer" },
            vinculados: { type: "integer" },
            resultados: { type: "array", items: { type: "object" } },
          }),
        },
      },

      // ---------------------------------------------------------------- Avisos
      "/api/v1/avisos": {
        get: {
          tags: ["Avisos"],
          summary: "Listar avisos y tareas",
          description: "Sin filtros, las pendientes de todas las delegaciones.",
          operationId: "listarAvisos",
          parameters: [
            PARAM_DELEGACIONES,
            {
              name: "estado",
              in: "query",
              schema: { type: "string", enum: ["pendiente", "hecha", "todas"], default: "pendiente" },
            },
            { name: "tipo", in: "query", schema: { type: "string", enum: ["tarea", "nota"] } },
            {
              name: "destinatario",
              in: "query",
              schema: { type: "string", enum: ["oficina_tecnica", "delegacion"] },
            },
            { name: "texto", in: "query", schema: { type: "string" } },
            { name: "limite", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: respuestaOk("Avisos.", {
            total: { type: "integer" },
            avisos: { type: "array", items: { $ref: "#/components/schemas/Aviso" } },
          }),
        },
        post: {
          tags: ["Avisos"],
          summary: "Dejar una nota o tarea en una delegación",
          operationId: "crearAviso",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    delegacion: { type: "string" },
                    contenido: { type: "string", maxLength: 2000 },
                    tipo: { type: "string", enum: ["tarea", "nota"], default: "nota" },
                    destinatario: {
                      type: "string",
                      enum: ["delegacion", "oficina_tecnica"],
                      default: "delegacion",
                    },
                    referencia: { type: "string", maxLength: 60 },
                    notificar: { type: "boolean", description: "Enviarlo además por correo." },
                    usuario_email: { type: "string", format: "email" },
                  },
                  required: ["delegacion", "contenido"],
                },
              },
            },
          },
          responses: respuestaOk("Aviso creado.", {
            aviso: { $ref: "#/components/schemas/Aviso" },
            notificados: { type: "array", items: { type: "string" } },
            aviso_notificacion: {
              type: "string",
              description: "Presente si el aviso se guardó pero el correo no pudo salir.",
            },
          }),
        },
      },
      "/api/v1/avisos/{id}": {
        get: {
          tags: ["Avisos"],
          summary: "Obtener un aviso",
          operationId: "getAviso",
          parameters: [PARAM_ID("del aviso")],
          responses: respuestaOk("Aviso.", { aviso: { $ref: "#/components/schemas/Aviso" } }),
        },
        patch: {
          tags: ["Avisos"],
          summary: "Editar un aviso o marcarlo como hecho",
          operationId: "actualizarAviso",
          parameters: [PARAM_ID("del aviso")],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contenido: { type: "string" },
                    referencia: { type: ["string", "null"] },
                    destinatario: { type: "string", enum: ["delegacion", "oficina_tecnica"] },
                    estado: { type: "string", enum: ["pendiente", "hecha"] },
                    usuario_email: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: respuestaOk("Aviso actualizado.", { aviso: { $ref: "#/components/schemas/Aviso" } }),
        },
        delete: {
          tags: ["Avisos"],
          summary: "Borrar un aviso",
          operationId: "eliminarAviso",
          parameters: [PARAM_ID("del aviso")],
          responses: respuestaOk("Aviso eliminado.", {
            eliminado: { type: "boolean", const: true },
            id: { type: "string", format: "uuid" },
          }),
        },
      },
      "/api/v1/avisos/{id}/notificar": {
        post: {
          tags: ["Avisos"],
          summary: "Enviar el aviso por correo",
          description:
            "A los tesoreros de su delegación o a la oficina técnica, según a quién vaya dirigido. Nunca a su autor.",
          operationId: "notificarAviso",
          parameters: [PARAM_ID("del aviso")],
          responses: respuestaOk("Correo enviado.", {
            aviso: { $ref: "#/components/schemas/Aviso" },
            notificados: { type: "array", items: { type: "string", format: "email" } },
          }),
        },
      },

      // -------------------------------------------------------------- Archivos
      "/api/v1/archivos/{id}": {
        get: {
          tags: ["Archivos"],
          summary: "Metadatos de un archivo",
          operationId: "getArchivo",
          parameters: [PARAM_ID("del archivo")],
          responses: respuestaOk("Archivo.", {
            archivo: { $ref: "#/components/schemas/Archivo" },
            asociado_a: { type: "object" },
          }),
        },
        delete: {
          tags: ["Archivos"],
          summary: "Borrar un archivo",
          operationId: "eliminarArchivo",
          parameters: [PARAM_ID("del archivo")],
          responses: respuestaOk("Archivo eliminado.", {
            eliminado: { type: "boolean", const: true },
            id: { type: "string", format: "uuid" },
          }),
        },
      },
      "/api/v1/archivos/{id}/url": {
        get: {
          tags: ["Archivos"],
          summary: "URL firmada de descarga",
          operationId: "urlArchivo",
          parameters: [
            PARAM_ID("del archivo"),
            {
              name: "segundos",
              in: "query",
              schema: { type: "integer", default: 300, minimum: 30, maximum: 3600 },
            },
          ],
          responses: respuestaOk("URL temporal.", {
            url: { type: "string", format: "uri" },
            nombre: { type: "string" },
            tipo_mime: { type: "string" },
            caduca_en_segundos: { type: "integer" },
          }),
        },
      },
      "/api/v1/archivos/{id}/descargar": {
        get: {
          tags: ["Archivos"],
          summary: "Descargar el archivo (redirección)",
          description: "Responde 302 hacia una URL firmada. Es el valor de `url_descarga` de cada adjunto.",
          operationId: "descargarArchivo",
          parameters: [PARAM_ID("del archivo")],
          responses: {
            "302": { description: "Redirección a la URL firmada del fichero." },
            ...RESPUESTAS_ERROR,
          },
        },
      },

      // -------------------------------------------------------------- Informes
      "/api/v1/resumen": {
        get: {
          tags: ["Informes"],
          summary: "Resumen económico por delegación",
          description:
            "Ingresos, gastos, neto y saldo por delegación, desglose por categoría y pendientes de cada una.\n\n" +
            "El saldo suma todo el histórico de las cuentas activas (incluidos los movimientos ignorados, porque refleja el extracto del banco); los ingresos y gastos respetan el rango de fechas y excluyen los ignorados.",
          operationId: "resumenEconomico",
          parameters: [
            PARAM_DELEGACIONES,
            { name: "desde", in: "query", schema: { type: "string", format: "date" } },
            { name: "hasta", in: "query", schema: { type: "string", format: "date" } },
            { name: "incluir_ignorados", in: "query", schema: { type: "boolean" } },
          ],
          responses: respuestaOk("Resumen.", {
            desde: { type: ["string", "null"], format: "date" },
            hasta: { type: ["string", "null"], format: "date" },
            totales: { type: "object" },
            por_delegacion: { type: "array", items: { type: "object" } },
            por_categoria: { type: "array", items: { type: "object" } },
          }),
        },
      },
      "/api/v1/pagos-mcm": {
        get: {
          tags: ["Informes"],
          summary: "Listar pagos MCM (reembolsos a personas)",
          description: "Solo lectura: el alta se hace desde la aplicación.",
          operationId: "listarPagosMcm",
          parameters: [
            PARAM_DELEGACIONES,
            { name: "estados", in: "query", schema: { type: "string" } },
            { name: "limite", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: respuestaOk("Pagos MCM.", {
            total: { type: "integer" },
            pagos: { type: "array", items: { type: "object" } },
          }),
        },
      },
    },
    components: {
      securitySchemes: {
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Clave de API en la cabecera x-api-key.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Clave de API como token Bearer en Authorization.",
        },
      },
      responses: {
        Error: {
          description:
            "Error. El campo `error` está escrito para leerse; `detalles` trae, cuando aplica, los valores válidos o los candidatos entre los que elegir.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean", const: false },
                  error: { type: "string" },
                  detalles: { type: "object" },
                },
                required: ["ok", "error"],
              },
            },
          },
        },
      },
      schemas: {
        Delegacion: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            codigo: { type: ["string", "null"] },
            nombre: { type: "string" },
          },
          required: ["id", "nombre"],
        },
        ArchivoEntrante: {
          type: "object",
          description: "Fichero a subir, codificado en base64 (máximo 3 MB por API).",
          properties: {
            nombre: { type: "string", description: "Nombre con extensión, p. ej. 'factura-octubre.pdf'." },
            contenido_base64: { type: "string", description: "Contenido del fichero en base64 (admite data URL)." },
            tipo_mime: { type: "string", description: "Si se omite, se deduce de la extensión." },
            descripcion: { type: "string" },
            bucket: { type: "string", enum: ["facturas", "documentos"], default: "facturas" },
            crear_factura: {
              type: "boolean",
              default: true,
              description: "Solo al adjuntar a un movimiento en el bucket 'facturas'.",
            },
            usuario_email: { type: "string", format: "email" },
          },
          required: ["nombre", "contenido_base64"],
        },
        Archivo: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            nombre_original: { type: "string" },
            tipo_mime: { type: "string" },
            tamano_bytes: { type: "integer" },
            es_factura: { type: "boolean" },
            descripcion: { type: ["string", "null"] },
            bucket: { type: "string", examples: ["facturas", "documentos"] },
            url: {
              type: "string",
              description:
                "URL pública heredada. Vacía en los archivos subidos desde que se pasó a URLs firmadas: usa `url_descarga`.",
            },
            url_descarga: {
              type: "string",
              format: "uri",
              description: "Endpoint autenticado que redirige a una URL firmada de descarga.",
            },
            path_storage: { type: "string" },
            subido_en: { type: "string", format: "date-time" },
          },
          required: ["id", "nombre_original", "tipo_mime", "tamano_bytes", "es_factura", "bucket", "subido_en"],
        },
        ResumenBusqueda: {
          type: "object",
          description: "Agregado de TODO el conjunto que cumple los filtros, no solo de la página.",
          properties: {
            movimientos: { type: "integer" },
            ingresos: { type: "number" },
            gastos: { type: "number", description: "Negativo." },
            neto: { type: "number" },
            truncado: {
              type: "boolean",
              description: "true si había más filas de las que se pudieron agregar.",
            },
            por_delegacion: { type: "array", items: { type: "object" } },
          },
        },
        Movimiento: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            fecha: { type: "string", format: "date" },
            concepto: { type: "string" },
            descripcion: { type: ["string", "null"] },
            contraparte: { type: ["string", "null"] },
            importe: { type: "number", description: "Positivo = ingreso, negativo = gasto." },
            tipo: { type: "string", enum: ["ingreso", "gasto"] },
            metodo: { type: ["string", "null"] },
            notas: { type: ["string", "null"] },
            ignorado: { type: "boolean" },
            factura_id: { type: ["string", "null"], format: "uuid" },
            factura_pendiente: { type: "boolean" },
            booking_date: { type: ["string", "null"], format: "date" },
            value_date: { type: ["string", "null"], format: "date" },
            origen_sync: { type: ["string", "null"] },
            creado_en: { type: "string", format: "date-time" },
            cuenta: {
              type: ["object", "null"],
              properties: {
                id: { type: "string", format: "uuid" },
                nombre: { type: "string" },
                tipo: { type: ["string", "null"] },
                banco_nombre: { type: ["string", "null"] },
                iban: { type: ["string", "null"] },
              },
            },
            categoria: {
              type: ["object", "null"],
              properties: {
                id: { type: "string", format: "uuid" },
                nombre: { type: "string" },
                tipo: { type: ["string", "null"] },
                emoji: { type: ["string", "null"] },
                color: { type: ["string", "null"] },
              },
            },
            delegacion: { anyOf: [{ $ref: "#/components/schemas/Delegacion" }, { type: "null" }] },
            contacto: {
              type: ["object", "null"],
              properties: {
                id: { type: "string", format: "uuid" },
                nombre: { type: "string" },
                tipo: { type: ["string", "null"] },
              },
            },
            archivos: { type: "array", items: { $ref: "#/components/schemas/Archivo" } },
          },
          required: ["id", "fecha", "concepto", "importe", "tipo", "creado_en", "archivos"],
        },
        Factura: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            numero: { type: ["string", "null"] },
            concepto: { type: ["string", "null"] },
            importe: { type: ["number", "null"], description: "Siempre positivo." },
            moneda: { type: "string" },
            fecha_emision: { type: ["string", "null"], format: "date" },
            estado: {
              type: "string",
              enum: ["bandeja", "sin_pagar", "pagada_parcial", "pagada", "pagada_fuera"],
            },
            origen: { type: "string", enum: ["subida", "movimiento", "email"] },
            notas: { type: ["string", "null"] },
            email_remitente: { type: ["string", "null"] },
            delegacion: { anyOf: [{ $ref: "#/components/schemas/Delegacion" }, { type: "null" }] },
            contacto: { type: ["object", "null"] },
            importe_pagado: { type: "number", description: "Suma de los movimientos vinculados." },
            importe_pendiente: { type: ["number", "null"] },
            movimientos: { type: "array", items: { type: "object" } },
            archivos: { type: "array", items: { $ref: "#/components/schemas/Archivo" } },
            creado_en: { type: "string", format: "date-time" },
            actualizado_en: { type: "string", format: "date-time" },
          },
          required: ["id", "estado", "origen", "importe_pagado", "movimientos", "archivos"],
        },
        Aviso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            tipo: { type: "string", enum: ["tarea", "nota"] },
            contenido: { type: "string" },
            referencia: { type: ["string", "null"] },
            destinatario: { type: "string", enum: ["oficina_tecnica", "delegacion"] },
            estado: { type: "string", enum: ["pendiente", "hecha"] },
            delegacion: { anyOf: [{ $ref: "#/components/schemas/Delegacion" }, { type: "null" }] },
            autor: { type: "object" },
            completado_por: { type: ["object", "null"] },
            completado_en: { type: ["string", "null"], format: "date-time" },
            notificado_en: { type: ["string", "null"], format: "date-time" },
            lecturas: { type: "integer" },
            creado_en: { type: "string", format: "date-time" },
            actualizado_en: { type: "string", format: "date-time" },
          },
          required: ["id", "tipo", "contenido", "destinatario", "estado"],
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
