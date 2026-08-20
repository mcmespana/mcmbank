import { describe, it, expect } from "vitest"
import { registerAC, unregisterAC, abortAllInFlight, inFlightSize } from "@/lib/db/in-flight"

/**
 * Registro global de peticiones en curso. Existe para un caso concreto y
 * molesto: Chrome puede dejar un `fetch` suspendido para siempre cuando la
 * pestaña pierde el foco a media petición, y ese fetch nunca resuelve por sí
 * solo — el hook se queda en `loading: true` para siempre. `abortAllInFlight`
 * es el botón de pánico que se llama al recuperar el foco.
 */

describe("registro de peticiones en curso", () => {
  it("empieza vacío", () => {
    expect(inFlightSize()).toBe(0)
  })

  it("registrar añade y desregistrar quita", () => {
    const ac = new AbortController()
    registerAC(ac)
    expect(inFlightSize()).toBe(1)
    unregisterAC(ac)
    expect(inFlightSize()).toBe(0)
  })

  it("abortAllInFlight aborta cada controller y vacía el registro", () => {
    const a = new AbortController()
    const b = new AbortController()
    registerAC(a)
    registerAC(b)

    abortAllInFlight()

    expect(a.signal.aborted).toBe(true)
    expect(b.signal.aborted).toBe(true)
    expect(inFlightSize()).toBe(0)
  })

  it("desregistrar algo que no estaba no rompe nada", () => {
    const ac = new AbortController()
    expect(() => unregisterAC(ac)).not.toThrow()
    expect(inFlightSize()).toBe(0)
  })

  it("un controller ya abortado a mano tampoco rompe abortAllInFlight", () => {
    const ac = new AbortController()
    ac.abort()
    registerAC(ac)
    expect(() => abortAllInFlight()).not.toThrow()
    expect(inFlightSize()).toBe(0)
  })
})
