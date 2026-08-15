import { describe, it, expect } from "vitest"
import { aEsquemaGemini } from "@/lib/api/gemini"

/**
 * La regresión que motiva este fichero: el schema de facturas declaraba los
 * campos opcionales en JSON Schema (`type: ["string", "null"]`) y
 * `generateContent` devolvía un 400 seco, que la UI traducía a "revisa
 * GEMINI_API_KEY y que el modelo exista" — mandando a buscar el problema
 * justo donde no estaba.
 */
describe("aEsquemaGemini", () => {
  it("convierte los tipos unión de JSON Schema en type + nullable", () => {
    expect(aEsquemaGemini({ type: ["string", "null"], description: "NIF" })).toEqual({
      type: "string",
      nullable: true,
      description: "NIF",
    })
  })

  it("deja intactos los tipos que ya son de un solo valor", () => {
    expect(aEsquemaGemini({ type: "boolean" })).toEqual({ type: "boolean" })
  })

  it("omite el type cuando lo único declarado es null", () => {
    expect(aEsquemaGemini({ type: ["null"] })).toEqual({ nullable: true })
  })

  it("baja por properties e items", () => {
    const convertido = aEsquemaGemini({
      type: "object",
      properties: {
        numero: { type: ["string", "null"] },
        lineas: { type: "array", items: { type: ["number", "null"] } },
      },
      required: ["numero"],
    })

    expect(convertido).toEqual({
      type: "object",
      properties: {
        numero: { type: "string", nullable: true },
        lineas: { type: "array", items: { type: "number", nullable: true } },
      },
      required: ["numero"],
    })
  })

  it("descarta las claves que el subconjunto de OpenAPI no reconoce", () => {
    // `additionalProperties` y `$schema` son JSON Schema puro: mandarlas es
    // otro 400 distinto, con el mismo aspecto.
    const convertido = aEsquemaGemini({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "string", default: "x" } },
    })

    expect(convertido).toEqual({ type: "object", properties: { a: { type: "string" } } })
  })

  it("conserva enum, format y los límites numéricos", () => {
    expect(
      aEsquemaGemini({ type: "string", enum: ["A", "B"], format: "date" }),
    ).toEqual({ type: "string", enum: ["A", "B"], format: "date" })
    expect(aEsquemaGemini({ type: "number", minimum: 0, maximum: 1 })).toEqual({
      type: "number",
      minimum: 0,
      maximum: 1,
    })
  })

  it("respeta un nullable explícito por encima del deducido", () => {
    expect(aEsquemaGemini({ type: ["string", "null"], nullable: false })).toEqual({
      type: "string",
      nullable: false,
    })
  })
})
