import { describe, it, expect } from "vitest"
import type { Categoria } from "@/lib/types/database"
import {
  getCategoryColorTokens,
  getReadableTextColor,
  resolveCategoryColor,
} from "@/lib/utils/category-colors"

type CatColor = Pick<Categoria, "id" | "color" | "tipo" | "categoria_padre_id">
const cat = (over: Partial<CatColor>): CatColor =>
  ({ id: "x", color: null, tipo: null, categoria_padre_id: null, ...over }) as CatColor

const FALLBACK = "#6366f1"

describe("resolveCategoryColor", () => {
  it("usa el color propio si lo tiene", () => {
    expect(resolveCategoryColor(cat({ color: "#ff0000", tipo: "gasto" }))).toBe("#ff0000")
  })

  it("un color en blanco no cuenta como color", () => {
    expect(resolveCategoryColor(cat({ color: "   ", tipo: "gasto" }))).toBe("#ef4444")
  })

  it("hereda el color de la categoría padre", () => {
    const todas = [cat({ id: "padre", color: "#123456" })]
    expect(resolveCategoryColor(cat({ id: "hija", categoria_padre_id: "padre" }), todas)).toBe(
      "#123456",
    )
  })

  it("sube por la jerarquía hasta encontrar un color", () => {
    const todas = [
      cat({ id: "abuela", color: "#abcdef" }),
      cat({ id: "madre", categoria_padre_id: "abuela" }),
    ]
    expect(resolveCategoryColor(cat({ id: "hija", categoria_padre_id: "madre" }), todas)).toBe(
      "#abcdef",
    )
  })

  it("si el padre no aparece en la lista, cae al color por tipo", () => {
    expect(resolveCategoryColor(cat({ categoria_padre_id: "fantasma", tipo: "ingreso" }), [])).toBe(
      "#10b981",
    )
  })

  it("los ingresos son verdes y los gastos rojos por defecto", () => {
    expect(resolveCategoryColor(cat({ tipo: "ingreso" }))).toBe("#10b981")
    expect(resolveCategoryColor(cat({ tipo: "gasto" }))).toBe("#ef4444")
  })

  it("sin nada de lo anterior, color de respaldo", () => {
    expect(resolveCategoryColor(cat({}))).toBe(FALLBACK)
    expect(resolveCategoryColor(cat({ tipo: "invento" as any }))).toBe(FALLBACK)
  })
})

describe("getReadableTextColor", () => {
  it("sobre fondo claro escribe en oscuro", () => {
    expect(getReadableTextColor("#ffffff")).toBe("#0f172a")
    expect(getReadableTextColor("#fef08a")).toBe("#0f172a")
  })

  it("sobre fondo oscuro escribe en claro", () => {
    expect(getReadableTextColor("#000000")).toBe("#f8fafc")
    expect(getReadableTextColor("#1e3a8a")).toBe("#f8fafc")
  })

  it("entiende hex de tres cifras", () => {
    expect(getReadableTextColor("#fff")).toBe("#0f172a")
    expect(getReadableTextColor("000")).toBe("#f8fafc")
  })

  it("entiende rgb() y rgba()", () => {
    expect(getReadableTextColor("rgb(255, 255, 255)")).toBe("#0f172a")
    expect(getReadableTextColor("rgba(0, 0, 0, 0.5)")).toBe("#f8fafc")
  })

  it("ante un color ilegible no revienta: texto oscuro", () => {
    expect(getReadableTextColor("no-es-un-color")).toBe("#0f172a")
    expect(getReadableTextColor("")).toBe("#0f172a")
  })

  it("el umbral de contraste es configurable", () => {
    // Con umbral 0 casi todo se considera claro.
    expect(getReadableTextColor("#1e3a8a", 0)).toBe("#0f172a")
  })
})

describe("getCategoryColorTokens", () => {
  it("devuelve color, texto legible y el rgb suelto para variables CSS", () => {
    expect(getCategoryColorTokens(cat({ color: "#ffffff" }))).toEqual({
      color: "#ffffff",
      textColor: "#0f172a",
      rgbValue: "255 255 255",
    })
  })

  it("un color no parseable conserva el valor pero usa el rgb de respaldo", () => {
    const tokens = getCategoryColorTokens(cat({ color: "chartreuse" }))
    expect(tokens.color).toBe("chartreuse")
    expect(tokens.rgbValue).toBe("99 102 241") // el del FALLBACK #6366f1
  })

  it("hereda el color del padre también en los tokens", () => {
    const todas = [cat({ id: "padre", color: "#000000" })]
    expect(getCategoryColorTokens(cat({ categoria_padre_id: "padre" }), todas).textColor).toBe(
      "#f8fafc",
    )
  })
})
