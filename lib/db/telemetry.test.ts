import { describe, it, expect } from "vitest"
import { addMetric, getMetrics, subscribe } from "@/lib/db/telemetry"

/**
 * Buffer en memoria de las últimas métricas de `runQuery`, para el panel de
 * diagnóstico. Lo que importa es que no crezca sin límite y que avise a
 * quien esté escuchando (el panel se refresca solo).
 */

function metrica(over: Partial<Parameters<typeof addMetric>[0]> = {}) {
  return { at: 1, label: "test", ms: 10, status: "ok" as const, ...over }
}

describe("telemetry", () => {
  it("getMetrics devuelve una copia, no la lista interna", async () => {
    addMetric(metrica())
    const a = getMetrics()
    a.push(metrica({ label: "intruso" }))
    const b = getMetrics()
    expect(b.some((m) => m.label === "intruso")).toBe(false)
  })

  it("no crece más allá de 200 entradas: las más viejas se descartan", async () => {
    for (let i = 0; i < 210; i++) addMetric(metrica({ label: `m-${i}` }))
    const metricas = getMetrics()
    expect(metricas.length).toBeLessThanOrEqual(200)
    expect(metricas[metricas.length - 1].label).toBe("m-209")
    expect(metricas.some((m) => m.label === "m-0")).toBe(false)
  })

  it("subscribe avisa a los oyentes cuando llega una métrica nueva", async () => {
    let avisos = 0
    const cancelar = subscribe(() => {
      avisos += 1
    })
    addMetric(metrica())
    addMetric(metrica())
    expect(avisos).toBe(2)
    cancelar()
    addMetric(metrica())
    expect(avisos).toBe(2) // tras cancelar, no se le vuelve a avisar
  })
})
