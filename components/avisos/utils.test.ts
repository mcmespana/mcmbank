import { describe, expect, it } from "vitest"
import { clicCierraPanel } from "./utils"

/**
 * Dobles mínimos del DOM: `clicCierraPanel` solo necesita `contains()` en el
 * panel y el botón, y `closest()` en el objetivo del clic. Los tests corren en
 * entorno node, sin DOM, así que se construyen a mano.
 */
function contenedor(hijos: object[]): HTMLElement {
  return { contains: (n: Node) => hijos.includes(n) } as unknown as HTMLElement
}

function elemento({ dentroDePortal = false } = {}): Element {
  return { closest: (sel: string) => (dentroDePortal && sel.includes("radix") ? {} : null) } as unknown as Element
}

/** Nodo de texto: no tiene closest(), hay que mirar a su elemento padre. */
function nodoTexto(padre: Element | null): Node {
  return { parentElement: padre } as unknown as Node
}

describe("clicCierraPanel", () => {
  const vacio = contenedor([])

  it("cierra cuando el clic cae de verdad fuera", () => {
    expect(clicCierraPanel(elemento(), vacio, vacio)).toBe(true)
  })

  it("no cierra si el clic es dentro del panel", () => {
    const dentro = elemento()
    expect(clicCierraPanel(dentro, contenedor([dentro]), vacio)).toBe(false)
  })

  it("no cierra si el clic es en el botón flotante", () => {
    const enBoton = elemento()
    expect(clicCierraPanel(enBoton, vacio, contenedor([enBoton]))).toBe(false)
  })

  // El fallo que motivó esta función: los desplegables viven en un portal
  // colgado del body, así que elegir un día del calendario cerraba el panel.
  it("no cierra si el clic es en un desplegable en portal (calendario, responsable…)", () => {
    expect(clicCierraPanel(elemento({ dentroDePortal: true }), vacio, vacio)).toBe(false)
  })

  it("resuelve un nodo de texto por su elemento padre", () => {
    expect(clicCierraPanel(nodoTexto(elemento({ dentroDePortal: true })), vacio, vacio)).toBe(false)
    expect(clicCierraPanel(nodoTexto(elemento()), vacio, vacio)).toBe(true)
  })

  it("cierra si no hay objetivo o el nodo ya no cuelga de nada", () => {
    expect(clicCierraPanel(null, vacio, vacio)).toBe(true)
    expect(clicCierraPanel(nodoTexto(null), vacio, vacio)).toBe(true)
  })
})
