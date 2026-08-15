import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { ApiError } from "@/lib/api/errors"
import {
  conApi,
  cuerpoJson,
  qBooleano,
  qLista,
  qNumero,
  qOpcion,
  qTexto,
} from "@/lib/api/route-helpers"

const params = (qs: string) => new URLSearchParams(qs)

describe("lectura de parámetros de la query string", () => {
  it("qTexto recorta y trata el vacío como ausente", () => {
    expect(qTexto(params("q=%20hola%20"), "q")).toBe("hola")
    expect(qTexto(params("q=%20%20"), "q")).toBeUndefined()
    expect(qTexto(params(""), "q")).toBeUndefined()
  })

  it("qNumero acepta coma decimal (que es como se escribe aquí)", () => {
    expect(qNumero(params("importe=12,5"), "importe")).toBe(12.5)
    expect(qNumero(params("importe=-3.25"), "importe")).toBe(-3.25)
    expect(qNumero(params(""), "importe")).toBeUndefined()
  })

  it("qNumero explica qué ha llegado cuando no es un número", () => {
    try {
      qNumero(params("importe=mucho"), "importe")
      expect.unreachable("debería lanzar")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(400)
      expect((err as ApiError).message).toContain("mucho")
    }
  })

  it("qBooleano entiende las formas que la gente escribe a mano", () => {
    for (const v of ["true", "1", "si", "sí", "TRUE", "Sí"]) {
      expect(qBooleano(params(`x=${encodeURIComponent(v)}`), "x")).toBe(true)
    }
    for (const v of ["false", "0", "no", "NO"]) {
      expect(qBooleano(params(`x=${v}`), "x")).toBe(false)
    }
    expect(qBooleano(params(""), "x")).toBeUndefined()
  })

  it("qBooleano rechaza cualquier otra cosa", () => {
    expect(() => qBooleano(params("x=quizas"), "x")).toThrow(ApiError)
  })

  it("qLista admite tanto repetir el parámetro como separarlo por comas", () => {
    expect(qLista(params("d=a&d=b"), "d")).toEqual(["a", "b"])
    expect(qLista(params("d=a,b"), "d")).toEqual(["a", "b"])
    expect(qLista(params("d=a,%20b&d=c"), "d")).toEqual(["a", "b", "c"])
  })

  it("qLista descarta los huecos y devuelve undefined si no queda nada", () => {
    expect(qLista(params("d=a,,b"), "d")).toEqual(["a", "b"])
    expect(qLista(params("d=%20,%20"), "d")).toBeUndefined()
    expect(qLista(params(""), "d")).toBeUndefined()
  })

  it("qOpcion valida contra la lista y publica los valores válidos", () => {
    expect(qOpcion(params("estado=bandeja"), "estado", ["bandeja", "pagada"])).toBe("bandeja")
    expect(qOpcion(params(""), "estado", ["bandeja"])).toBeUndefined()

    try {
      qOpcion(params("estado=inventado"), "estado", ["bandeja", "pagada"])
      expect.unreachable("debería lanzar")
    } catch (err) {
      expect((err as ApiError).detalles).toEqual({ valores_validos: ["bandeja", "pagada"] })
    }
  })
})

describe("cuerpoJson", () => {
  const post = (body: BodyInit) =>
    new Request("https://mcmbank.test/api/v1/facturas", { method: "POST", body })

  it("devuelve el objeto del cuerpo", async () => {
    await expect(cuerpoJson(post(JSON.stringify({ importe: 10 })))).resolves.toEqual({ importe: 10 })
  })

  it("rechaza lo que no es JSON", async () => {
    await expect(cuerpoJson(post("{no json"))).rejects.toThrow("no es JSON válido")
  })

  it("rechaza un array o un escalar en la raíz", async () => {
    await expect(cuerpoJson(post("[1,2]"))).rejects.toThrow("debe ser un objeto JSON")
    await expect(cuerpoJson(post('"texto"'))).rejects.toThrow("debe ser un objeto JSON")
    await expect(cuerpoJson(post("null"))).rejects.toThrow("debe ser un objeto JSON")
  })
})

describe("conApi", () => {
  const ORIGINAL = process.env.MCM_API_KEY

  beforeEach(() => {
    process.env.MCM_API_KEY = "clave"
    delete process.env.MCM_API_KEY_READONLY
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MCM_API_KEY
    else process.env.MCM_API_KEY = ORIGINAL
  })

  const req = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { headers: { "x-api-key": "clave", ...headers } })

  it("envuelve el resultado en { ok: true, ... }", async () => {
    const res = await conApi(req("https://mcmbank.test/api/v1/x?a=1"), "read", async () => ({
      movimientos: [],
    }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, movimientos: [] })
  })

  it("no ejecuta el cuerpo si la clave no vale", async () => {
    const fn = vi.fn()
    const res = await conApi(
      new Request("https://mcmbank.test/api/v1/x", { headers: { "x-api-key": "otra" } }),
      "read",
      fn as any,
    )
    expect(res.status).toBe(401)
    expect(fn).not.toHaveBeenCalled()
  })

  it("una operación de escritura con clave de solo lectura no llega al cuerpo", async () => {
    process.env.MCM_API_KEY = "escritura"
    process.env.MCM_API_KEY_READONLY = "lectura"
    const fn = vi.fn()
    const res = await conApi(
      new Request("https://mcmbank.test/api/v1/x", { headers: { "x-api-key": "lectura" } }),
      "write",
      fn as any,
    )
    expect(res.status).toBe(403)
    expect(fn).not.toHaveBeenCalled()
  })

  it("pasa el ámbito, la baseUrl, los parámetros y quién firma", async () => {
    let visto: any
    await conApi(
      req("https://mcmbank.test/api/v1/x?desde=2026-01-01", {
        "x-mcm-usuario-email": "david@movimientoconsolacion.com",
      }),
      "read",
      async (ctx) => {
        visto = ctx
        return {}
      },
    )
    expect(visto.scope).toBe("write")
    expect(visto.baseUrl).toBe("https://mcmbank.test")
    expect(visto.params.get("desde")).toBe("2026-01-01")
    expect(visto.actorHint.usuario_email).toBe("david@movimientoconsolacion.com")
    expect(visto.actorHint.usuario_id).toBeNull()
  })

  it("un ApiError del cuerpo se convierte en su código HTTP", async () => {
    const res = await conApi(req("https://mcmbank.test/api/v1/x"), "read", async () => {
      throw new ApiError(404, "No existe.")
    })
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ ok: false, error: "No existe." })
  })

  it("un error inesperado sale como 500 y no tumba la ruta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await conApi(req("https://mcmbank.test/api/v1/x"), "read", async () => {
      throw new Error("la base de datos se ha caído")
    })
    expect(res.status).toBe(500)
    vi.restoreAllMocks()
  })
})
