import { describe, it, expect } from "vitest"
import { ApiError } from "@/lib/api/errors"
import { booleano, fecha, lista, numero, opcion, texto, textoObligatorio } from "@/lib/mcp/args"

/**
 * Estas pruebas fijan la tolerancia que se espera con lo que manda un modelo:
 * números como texto, listas como cadena suelta, fechas en formato español.
 * Si alguien la endurece sin querer, aquí se nota.
 */

describe("numero", () => {
  it("acepta un número normal", () => {
    expect(numero({ importe: 50 }, "importe")).toBe(50)
  })

  it("acepta un número escrito como texto, con coma decimal", () => {
    expect(numero({ importe: "50,25" }, "importe")).toBe(50.25)
  })

  it("devuelve undefined si no viene", () => {
    expect(numero({}, "importe")).toBeUndefined()
    expect(numero({ importe: "" }, "importe")).toBeUndefined()
  })

  it("rechaza lo que no es un número, diciendo qué llegó", () => {
    expect(() => numero({ importe: "mucho" }, "importe")).toThrow(/importe.*mucho/)
  })
})

describe("booleano", () => {
  it("entiende las formas habituales de decir sí y no", () => {
    expect(booleano({ x: true }, "x")).toBe(true)
    expect(booleano({ x: "true" }, "x")).toBe(true)
    expect(booleano({ x: "sí" }, "x")).toBe(true)
    expect(booleano({ x: "false" }, "x")).toBe(false)
    expect(booleano({ x: "no" }, "x")).toBe(false)
  })

  it("rechaza un valor ambiguo", () => {
    expect(() => booleano({ x: "quizá" }, "x")).toThrow(ApiError)
  })
})

describe("lista", () => {
  it("acepta un array", () => {
    expect(lista({ d: ["Sevilla", "Madrid"] }, "d")).toEqual(["Sevilla", "Madrid"])
  })

  it("acepta un valor suelto", () => {
    expect(lista({ d: "Sevilla" }, "d")).toEqual(["Sevilla"])
  })

  it("acepta una cadena separada por comas", () => {
    expect(lista({ d: "Sevilla, Madrid" }, "d")).toEqual(["Sevilla", "Madrid"])
  })

  it("una lista vacía es como no filtrar", () => {
    expect(lista({ d: [] }, "d")).toBeUndefined()
  })
})

describe("fecha", () => {
  it("deja pasar el formato ISO", () => {
    expect(fecha({ f: "2026-03-04" }, "f")).toBe("2026-03-04")
  })

  it("traduce el formato español", () => {
    expect(fecha({ f: "4/3/2026" }, "f")).toBe("2026-03-04")
    expect(fecha({ f: "04-03-2026" }, "f")).toBe("2026-03-04")
  })

  it("rechaza lo que no es una fecha", () => {
    expect(() => fecha({ f: "el martes pasado" }, "f")).toThrow(/AAAA-MM-DD/)
  })
})

describe("texto y opcion", () => {
  it("recorta y trata la cadena vacía como ausencia", () => {
    expect(texto({ t: "  hola  " }, "t")).toBe("hola")
    expect(texto({ t: "   " }, "t")).toBeUndefined()
  })

  it("textoObligatorio explica qué falta", () => {
    expect(() => textoObligatorio({}, "delegacion")).toThrow(/Falta 'delegacion'/)
  })

  it("opcion enumera los valores válidos al fallar", () => {
    try {
      opcion({ tipo: "gastito" }, "tipo", ["ingreso", "gasto"] as const)
      throw new Error("debería haber lanzado")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).detalles).toEqual({ valores_validos: ["ingreso", "gasto"] })
    }
  })
})
