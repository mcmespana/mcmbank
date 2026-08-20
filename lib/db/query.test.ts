import { describe, it, expect, beforeEach, vi } from "vitest"
import { inFlightSize, abortAllInFlight } from "@/lib/db/in-flight"
import { getMetrics } from "@/lib/db/telemetry"

/**
 * `runQuery` es donde vive el manejo de timeout, el reintento cuando el token
 * ha caducado a media consulta, y la traducción de un abort interno (timeout,
 * o `abortAllInFlight` al volver a la pestaña) a un mensaje que no asuste al
 * usuario con texto de depuración ("tab-focus-reset").
 */

const refreshSession = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { refreshSession: (...args: any[]) => refreshSession(...args) } },
}))

beforeEach(() => {
  refreshSession.mockReset()
  refreshSession.mockResolvedValue({ data: {}, error: null })
})

async function importRunQuery() {
  const { runQuery } = await import("@/lib/db/query")
  return runQuery
}

describe("runQuery · camino feliz", () => {
  it("devuelve los datos de build() y registra la métrica como 'ok'", async () => {
    const runQuery = await importRunQuery()
    const antes = getMetrics().length
    const resultado = await runQuery({ label: "test", build: async () => ({ data: [1, 2, 3], error: null }) })
    expect(resultado).toEqual({ data: [1, 2, 3], error: null })
    expect(getMetrics().at(-1)).toMatchObject({ label: "test", status: "ok" })
    expect(getMetrics().length).toBe(antes + 1)
  })

  it("desregistra el AbortController al terminar (no se queda 'en curso')", async () => {
    const runQuery = await importRunQuery()
    const antes = inFlightSize()
    await runQuery({ label: "test", build: async () => ({ data: 1, error: null }) })
    expect(inFlightSize()).toBe(antes)
  })
})

describe("runQuery · reintento por sesión caducada", () => {
  it("un 401 refresca la sesión y reintenta la consulta", async () => {
    const runQuery = await importRunQuery()
    let llamadas = 0
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        return llamadas === 1
          ? { data: null, error: { code: "401", message: "jwt expired" } }
          : { data: "ok-tras-refrescar", error: null }
      },
    })
    expect(llamadas).toBe(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(resultado.data).toBe("ok-tras-refrescar")
  })

  it("un mensaje que menciona 'token' también dispara el reintento aunque no traiga código", async () => {
    const runQuery = await importRunQuery()
    let llamadas = 0
    await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        return llamadas === 1
          ? { data: null, error: { message: "Invalid token" } }
          : { data: "ok", error: null }
      },
    })
    expect(llamadas).toBe(2)
  })

  it("un error normal (no de auth) no refresca ni reintenta", async () => {
    const runQuery = await importRunQuery()
    let llamadas = 0
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        return { data: null, error: { message: "constraint violation" } }
      },
    })
    expect(llamadas).toBe(1)
    expect(refreshSession).not.toHaveBeenCalled()
    expect(resultado.error).toMatchObject({ message: "constraint violation" })
  })

  it("con retryOnAuth: false, un 401 no reintenta", async () => {
    const runQuery = await importRunQuery()
    let llamadas = 0
    await runQuery({
      label: "test",
      retryOnAuth: false,
      build: async () => {
        llamadas += 1
        return { data: null, error: { code: "401" } }
      },
    })
    expect(llamadas).toBe(1)
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it("si refrescar la sesión falla, sigue reintentando la consulta igualmente", async () => {
    refreshSession.mockRejectedValue(new Error("no hay red"))
    const runQuery = await importRunQuery()
    let llamadas = 0
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        return llamadas === 1 ? { data: null, error: { code: "401" } } : { data: "ok", error: null }
      },
    })
    expect(llamadas).toBe(2)
    expect(resultado.data).toBe("ok")
  })
})

describe("runQuery · abort", () => {
  it("si algo aborta todo (volver a la pestaña) justo tras un 401, no llega a refrescar ni reintentar", async () => {
    const runQuery = await importRunQuery()
    let llamadas = 0
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        // El controller de esta query ya está en el registro global en cuanto
        // build() se ejecuta: abortarlo aquí simula `abortAllInFlight()`
        // disparándose justo después de que la consulta original devolviera
        // el 401, antes de que le diera tiempo a refrescar la sesión.
        abortAllInFlight()
        return { data: null, error: { code: "401" } }
      },
    })
    expect(llamadas).toBe(1)
    expect(refreshSession).not.toHaveBeenCalled()
    expect((resultado.error as Error).message).toBe("Request aborted")
  })

  it("si el abort llega mientras se refrescaba la sesión, tampoco reintenta la consulta", async () => {
    refreshSession.mockImplementation(async () => {
      abortAllInFlight()
      return { data: {}, error: null }
    })
    const runQuery = await importRunQuery()
    let llamadas = 0
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        llamadas += 1
        return { data: null, error: { code: "401" } }
      },
    })
    expect(llamadas).toBe(1)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect((resultado.error as Error).message).toBe("Request aborted")
  })

  it("un rechazo cuyo motivo es el propio abort no se cuela como texto interno", async () => {
    const runQuery = await importRunQuery()
    const resultado = await runQuery({
      label: "test",
      timeoutMs: 5,
      build: (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason))
        }),
    })
    expect(resultado.error).toBeInstanceOf(Error)
    expect((resultado.error as Error).message).toBe("Request aborted")
  })

  it("un error de red normal (sin abortar) se propaga tal cual", async () => {
    const runQuery = await importRunQuery()
    const resultado = await runQuery({
      label: "test",
      build: async () => {
        throw new Error("fetch failed")
      },
    })
    expect((resultado.error as Error).message).toBe("fetch failed")
  })

  it("registra la métrica como 'timeout' cuando el abort viene del temporizador", async () => {
    const runQuery = await importRunQuery()
    await runQuery({
      label: "consulta-lenta",
      timeoutMs: 5,
      build: (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason))
        }),
    })
    expect(getMetrics().at(-1)).toMatchObject({ label: "consulta-lenta", status: "timeout" })
  })
})
