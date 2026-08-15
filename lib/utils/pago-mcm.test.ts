import { describe, it, expect } from "vitest"
import {
  PAGO_MCM_ESTADO_INFO,
  PAGO_MCM_GASOLINA_PRESETS,
  PAGO_MCM_GASOLINA_PRESETS_ORDER,
  PAGO_MCM_TIPO_CALCULO_INFO,
  calcularImporteGasolinaKm,
  inferirPresetGasolina,
} from "@/lib/utils/pago-mcm"
import { PAGO_MCM_ESTADOS, PAGO_MCM_TIPOS_CALCULO } from "@/lib/types/database"

describe("calcularImporteGasolinaKm", () => {
  it("multiplica kilómetros por el precio", () => {
    expect(calcularImporteGasolinaKm(100, false, 0.26)).toBe(26)
  })

  it("ida y vuelta dobla los kilómetros", () => {
    expect(calcularImporteGasolinaKm(100, true, 0.26)).toBe(52)
  })

  it("redondea a dos decimales, que es lo que se transfiere", () => {
    expect(calcularImporteGasolinaKm(37, true, 0.18)).toBe(13.32)
    expect(calcularImporteGasolinaKm(1, false, 0.125)).toBe(0.13)
  })

  it("los datos que faltan valen cero, no NaN", () => {
    expect(calcularImporteGasolinaKm(null, true, 0.26)).toBe(0)
    expect(calcularImporteGasolinaKm(100, true, null)).toBe(0)
    expect(calcularImporteGasolinaKm(undefined, false, undefined)).toBe(0)
    expect(calcularImporteGasolinaKm("no" as any, false, 0.2)).toBe(0)
  })

  it("acepta kilómetros escritos como texto", () => {
    expect(calcularImporteGasolinaKm("50" as any, false, 0.2)).toBe(10)
  })
})

describe("inferirPresetGasolina", () => {
  it("reconoce cada precio de referencia", () => {
    expect(inferirPresetGasolina(0.12)).toBe("ivaj_0_12")
    expect(inferirPresetGasolina(0.18)).toBe("min_0_18")
    expect(inferirPresetGasolina(0.2)).toBe("max_0_20")
    expect(inferirPresetGasolina(0.26)).toBe("estandar_0_26")
  })

  it("un precio a mano se marca como personalizado", () => {
    expect(inferirPresetGasolina(0.31)).toBe("personalizado")
    expect(inferirPresetGasolina(0)).toBe("personalizado")
  })

  it("sin precio propone el estándar", () => {
    expect(inferirPresetGasolina(null)).toBe("estandar_0_26")
    expect(inferirPresetGasolina(undefined)).toBe("estandar_0_26")
  })

  it("tolera el ruido de coma flotante", () => {
    expect(inferirPresetGasolina(0.1 + 0.02)).toBe("ivaj_0_12")
  })

  it("ida y vuelta con un preset da el importe esperado de punta a punta", () => {
    const preset = inferirPresetGasolina(0.18)
    const precio = PAGO_MCM_GASOLINA_PRESETS[preset].precio
    expect(calcularImporteGasolinaKm(120, true, precio)).toBe(43.2)
  })
})

describe("catálogos de pagos MCM", () => {
  it("hay información de UI para todos los estados", () => {
    for (const estado of PAGO_MCM_ESTADOS) {
      expect(PAGO_MCM_ESTADO_INFO[estado]?.value).toBe(estado)
      expect(PAGO_MCM_ESTADO_INFO[estado].label.length).toBeGreaterThan(0)
    }
  })

  it("hay información de UI para todos los tipos de cálculo", () => {
    for (const tipo of PAGO_MCM_TIPOS_CALCULO) {
      expect(PAGO_MCM_TIPO_CALCULO_INFO[tipo]?.value).toBe(tipo)
    }
  })

  it("el cálculo avanzado sigue deshabilitado", () => {
    expect(PAGO_MCM_TIPO_CALCULO_INFO.gasolina_avanzado.disabled).toBe(true)
    expect(PAGO_MCM_TIPO_CALCULO_INFO.manual.disabled).toBeUndefined()
  })

  it("el orden de presets los incluye todos, una sola vez", () => {
    const claves = Object.keys(PAGO_MCM_GASOLINA_PRESETS).sort()
    expect([...PAGO_MCM_GASOLINA_PRESETS_ORDER].sort()).toEqual(claves)
  })

  it("'personalizado' va el último para que no se elija sin querer", () => {
    expect(PAGO_MCM_GASOLINA_PRESETS_ORDER.at(-1)).toBe("personalizado")
  })
})
