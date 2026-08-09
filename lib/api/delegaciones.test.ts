import { describe, it, expect } from "vitest"
import { ApiError } from "@/lib/api/errors"
import { encontrarDelegacion, type DelegacionPublica } from "@/lib/api/delegaciones"

const DELEGACIONES: DelegacionPublica[] = [
  { id: "11111111-1111-1111-1111-111111111111", codigo: "SEV", nombre: "Sevilla" },
  { id: "22222222-2222-2222-2222-222222222222", codigo: "MAD", nombre: "Madrid" },
  { id: "33333333-3333-3333-3333-333333333333", codigo: "CAD", nombre: "Cádiz" },
  { id: "44444444-4444-4444-4444-444444444444", codigo: "SEVE", nombre: "Sevilla Este" },
]

describe("encontrarDelegacion", () => {
  it("acepta el id", () => {
    expect(encontrarDelegacion(DELEGACIONES, DELEGACIONES[1].id).nombre).toBe("Madrid")
  })

  it("acepta el código, sin distinguir mayúsculas", () => {
    expect(encontrarDelegacion(DELEGACIONES, "mad").nombre).toBe("Madrid")
  })

  it("acepta el nombre sin acentos", () => {
    expect(encontrarDelegacion(DELEGACIONES, "cadiz").nombre).toBe("Cádiz")
  })

  it("ignora el relleno con el que la gente nombra una delegación", () => {
    expect(encontrarDelegacion(DELEGACIONES, "la delegación de Madrid").nombre).toBe("Madrid")
  })

  it("prefiere el nombre exacto antes que la coincidencia parcial", () => {
    // "Sevilla" también está contenido en "Sevilla Este": debe ganar el exacto.
    expect(encontrarDelegacion(DELEGACIONES, "Sevilla").nombre).toBe("Sevilla")
  })

  it("cuando es ambiguo, devuelve los candidatos para poder reintentar", () => {
    const ambiguas: DelegacionPublica[] = [
      { id: "a", codigo: null, nombre: "Sevilla Norte" },
      { id: "b", codigo: null, nombre: "Sevilla Sur" },
    ]
    try {
      encontrarDelegacion(ambiguas, "sevilla")
      throw new Error("debería haber lanzado")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(400)
      expect((err as ApiError).detalles).toMatchObject({
        candidatos: [
          { id: "a", nombre: "Sevilla Norte" },
          { id: "b", nombre: "Sevilla Sur" },
        ],
      })
    }
  })

  it("si no existe, lista las disponibles", () => {
    try {
      encontrarDelegacion(DELEGACIONES, "Lisboa")
      throw new Error("debería haber lanzado")
    } catch (err) {
      expect((err as ApiError).status).toBe(404)
      expect((err as ApiError).detalles).toMatchObject({
        delegaciones_disponibles: ["Sevilla", "Madrid", "Cádiz", "Sevilla Este"],
      })
    }
  })

  it("un id inexistente no se confunde con un nombre", () => {
    expect(() =>
      encontrarDelegacion(DELEGACIONES, "99999999-9999-9999-9999-999999999999"),
    ).toThrow(/No existe ninguna delegación con el id/)
  })
})
