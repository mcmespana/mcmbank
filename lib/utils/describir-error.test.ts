import { describe, it, expect } from "vitest"
import { describirError, esAbort } from "@/lib/utils/describir-error"

/**
 * `describirError` existe porque `err instanceof Error` no sirve con los
 * errores de PostgREST/Supabase: son objetos planos con
 * `message`/`details`/`hint`/`code`. Lo que importa comprobar es justo eso
 * (que se lean sin ser instancias de `Error`) y que el texto final se pueda
 * copiar y pegar en un parte, no que quede bonito.
 */

describe("describirError", () => {
  it("lee un error plano de PostgREST (no es instanceof Error)", () => {
    const error = { message: "duplicate key value", details: "Key already exists", code: "23505" }
    expect(error).not.toBeInstanceOf(Error)
    const texto = describirError(error)
    expect(texto).toContain("duplicate key value")
    expect(texto).toContain("Key already exists")
    expect(texto).toContain("[23505]")
  })

  it("añade la pista con su propio prefijo", () => {
    const texto = describirError({ message: "no encontrado", hint: "revisa el id" })
    expect(texto).toContain("Pista: revisa el id")
  })

  it("quita las partes duplicadas (PostgREST repite el mensaje en details)", () => {
    const texto = describirError({ message: "fallo", details: "fallo" })
    expect(texto).toBe("fallo")
  })

  it("acepta directamente una cadena", () => {
    expect(describirError("algo se rompió")).toBe("algo se rompió")
  })

  it("con un contexto, lo antepone", () => {
    const texto = describirError({ message: "fallo" }, "Al guardar el movimiento")
    expect(texto).toBe("Al guardar el movimiento: fallo")
  })

  it("un error sin ningún campo útil no se queda vacío", () => {
    expect(describirError({})).toBe("Ha fallado algo y el error ha venido vacío")
    expect(describirError(null)).toBe("Ha fallado algo y el error ha venido vacío")
  })

  it("con contexto pero sin detalle, usa el contexto tal cual", () => {
    expect(describirError({}, "Al exportar")).toBe("Al exportar")
  })

  it("ignora campos vacíos o que no son texto", () => {
    const texto = describirError({ message: "  ", details: 123, hint: "", code: "PGRST100" })
    expect(texto).toBe("[PGRST100]")
  })

  it("también funciona con un Error normal, por si acaso", () => {
    expect(describirError(new Error("boom"))).toBe("boom")
  })
})

describe("esAbort", () => {
  it("reconoce un AbortError de verdad", () => {
    const controller = new AbortController()
    controller.abort()
    try {
      // DOMException con name "AbortError" es lo que produce fetch al abortar.
      throw new DOMException("The operation was aborted.", "AbortError")
    } catch (err) {
      expect(esAbort(err)).toBe(true)
    }
  })

  it("reconoce un mensaje que menciona 'abort' aunque no sea un AbortError", () => {
    expect(esAbort(new Error("The user aborted a request"))).toBe(true)
    expect(esAbort("aborted by the user")).toBe(true)
  })

  it("un error normal no es un abort, y no se cuela como si lo fuera", () => {
    expect(esAbort(new Error("Network error"))).toBe(false)
    expect(esAbort({ message: "fallo al guardar" })).toBe(false)
  })

  it("valores nulos o vacíos no son abort", () => {
    expect(esAbort(null)).toBe(false)
    expect(esAbort(undefined)).toBe(false)
  })
})
