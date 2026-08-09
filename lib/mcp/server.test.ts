import { describe, it, expect } from "vitest"
import { procesarMensaje } from "@/lib/mcp/server"
import { HERRAMIENTAS } from "@/lib/mcp/tools"
import { PROTOCOLO_POR_DEFECTO } from "@/lib/mcp/protocol"

const OPCIONES = { scope: "read" as const, baseUrl: "https://ejemplo.test", actorHint: {} }

/**
 * Comprueba el protocolo, no las herramientas: nada de aquí toca la base de
 * datos. Es la red de seguridad de que un cliente MCP puede completar el
 * saludo y descubrir las herramientas.
 */
describe("procesarMensaje", () => {
  it("responde al initialize con la versión que pide el cliente si la soporta", async () => {
    const respuesta: any = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      },
      OPCIONES,
    )
    expect(respuesta.result.protocolVersion).toBe("2024-11-05")
    expect(respuesta.result.capabilities.tools).toBeDefined()
    expect(respuesta.result.serverInfo.name).toBe("mcm-bank")
    expect(respuesta.result.instructions).toContain("delegaciones")
  })

  it("cae en la versión por defecto si la pedida no se soporta", async () => {
    const respuesta: any = await procesarMensaje(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } },
      OPCIONES,
    )
    expect(respuesta.result.protocolVersion).toBe(PROTOCOLO_POR_DEFECTO)
  })

  it("no responde a las notificaciones", async () => {
    expect(
      await procesarMensaje({ jsonrpc: "2.0", method: "notifications/initialized" }, OPCIONES),
    ).toBeNull()
  })

  it("lista las herramientas con su esquema", async () => {
    const respuesta: any = await procesarMensaje({ jsonrpc: "2.0", id: 2, method: "tools/list" }, OPCIONES)
    const tools = respuesta.result.tools

    expect(tools.length).toBe(HERRAMIENTAS.length)
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string")
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe("object")
    }
    expect(tools.map((t: any) => t.name)).toContain("buscar_movimientos")
  })

  it("una clave de solo lectura no puede usar una herramienta de escritura", async () => {
    const respuesta: any = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "crear_aviso", arguments: { delegacion: "Sevilla", contenido: "hola" } },
      },
      OPCIONES,
    )
    expect(respuesta.result.isError).toBe(true)
    expect(respuesta.result.content[0].text).toContain("solo lectura")
  })

  it("una herramienta inexistente devuelve la lista de las que hay", async () => {
    const respuesta: any = await procesarMensaje(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "no_existe", arguments: {} } },
      OPCIONES,
    )
    expect(respuesta.result.isError).toBe(true)
    expect(respuesta.result.content[0].text).toContain("buscar_movimientos")
  })

  it("un método desconocido es un error de JSON-RPC", async () => {
    const respuesta: any = await procesarMensaje({ jsonrpc: "2.0", id: 5, method: "foo" }, OPCIONES)
    expect(respuesta.error.code).toBe(-32601)
  })

  it("conciliar_facturas solo exige escritura cuando se pide aplicar", async () => {
    const propuesta: any = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "conciliar_facturas", arguments: { facturas: [] } },
      },
      OPCIONES,
    )
    // Falla por otra razón (lista vacía), no por permisos.
    expect(propuesta.result.content[0].text).not.toContain("solo lectura")

    const aplicando: any = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "conciliar_facturas", arguments: { facturas: [], aplicar: true } },
      },
      OPCIONES,
    )
    expect(aplicando.result.content[0].text).toContain("solo lectura")
  })
})

describe("catálogo de herramientas", () => {
  it("no hay nombres repetidos", () => {
    const nombres = HERRAMIENTAS.map((h) => h.name)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it("todo campo obligatorio del esquema está declarado en properties", () => {
    for (const herramienta of HERRAMIENTAS) {
      const esquema = herramienta.inputSchema as any
      for (const obligatorio of esquema.required ?? []) {
        expect(
          Object.keys(esquema.properties),
          `${herramienta.name} exige '${obligatorio}' pero no lo declara`,
        ).toContain(obligatorio)
      }
    }
  })
})
