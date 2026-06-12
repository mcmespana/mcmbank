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
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MCM Bank API externa",
      version: "1.0.0",
      description:
        "API de solo lectura para consultar movimientos de MCM Bank desde " +
        "aplicaciones internas (p.ej. Google Apps Script). El ID de un " +
        "movimiento es único en toda la base de datos, así que no hace falta " +
        "indicar la delegación.\n\n" +
        "**Autenticación:** envía la clave en la cabecera `Authorization: " +
        "Bearer <clave>` o `x-api-key: <clave>`.",
    },
    servers: [{ url: origin, description: "Servidor actual" }],
    tags: [{ name: "Movimientos", description: "Consulta de movimientos y sus archivos" }],
    security: [{ apiKeyHeader: [] }, { bearerAuth: [] }],
    paths: {
      "/api/v1/movimientos/{id}": {
        get: {
          tags: ["Movimientos"],
          summary: "Obtener un movimiento por su ID (datos + archivos)",
          description:
            "Devuelve el movimiento con sus relaciones (cuenta, categoría, " +
            "delegación, contacto) y la lista de archivos adjuntos embebida.",
          operationId: "getMovimiento",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "ID (UUID) del movimiento.",
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Movimiento encontrado.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      movimiento: { $ref: "#/components/schemas/Movimiento" },
                    },
                    required: ["ok", "movimiento"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/movimientos/{id}/archivos": {
        get: {
          tags: ["Movimientos"],
          summary: "Obtener solo los archivos de un movimiento",
          description:
            "Devuelve únicamente los archivos adjuntos del movimiento, con su " +
            "URL pública de descarga.",
          operationId: "getMovimientoArchivos",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "ID (UUID) del movimiento.",
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Lista de archivos del movimiento.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      movimiento_id: { type: "string", format: "uuid" },
                      total: { type: "integer" },
                      archivos: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Archivo" },
                      },
                    },
                    required: ["ok", "movimiento_id", "total", "archivos"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
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
          description: "Error.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean", const: false },
                  error: { type: "string" },
                },
                required: ["ok", "error"],
              },
            },
          },
        },
      },
      schemas: {
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
              format: "uri",
              description: "URL pública directa de descarga (sin autenticación).",
            },
            subido_en: { type: "string", format: "date-time" },
          },
          required: [
            "id",
            "nombre_original",
            "tipo_mime",
            "tamano_bytes",
            "es_factura",
            "bucket",
            "url",
            "subido_en",
          ],
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
            delegacion: {
              type: ["object", "null"],
              properties: {
                id: { type: "string", format: "uuid" },
                codigo: { type: ["string", "null"] },
                nombre: { type: "string" },
              },
            },
            contacto: {
              type: ["object", "null"],
              properties: {
                id: { type: "string", format: "uuid" },
                nombre: { type: "string" },
                tipo: { type: ["string", "null"] },
              },
            },
            archivos: {
              type: "array",
              items: { $ref: "#/components/schemas/Archivo" },
            },
          },
          required: ["id", "fecha", "concepto", "importe", "tipo", "creado_en", "archivos"],
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
