import { describe, it, expect } from "vitest"
import {
  AVATAR_PALETTES,
  getInitials,
  getPaletteFromString,
  isCustomEmoji,
} from "@/lib/utils/avatar"

describe("getInitials", () => {
  it("toma la inicial del nombre y la del apellido", () => {
    expect(getInitials("María García")).toBe("MG")
  })

  it("salta artículos y preposiciones cuando hay más de dos palabras", () => {
    expect(getInitials("Asociación Hijas de la Caridad")).toBe("AH")
    expect(getInitials("Colegio de San Vicente")).toBe("CV")
  })

  it("con dos palabras no salta nada, aunque una sea artículo", () => {
    expect(getInitials("La Caixa")).toBe("LC")
  })

  it("con una sola palabra usa sus dos primeras letras", () => {
    expect(getInitials("Juan")).toBe("JU")
    expect(getInitials("j")).toBe("J")
  })

  it("sin nombre devuelve un punto medio", () => {
    expect(getInitials("")).toBe("·")
    expect(getInitials("   ")).toBe("·")
    expect(getInitials(null)).toBe("·")
    expect(getInitials(undefined)).toBe("·")
  })

  it("ignora los espacios de más", () => {
    expect(getInitials("  ana    lopez  ")).toBe("AL")
  })
})

describe("getPaletteFromString", () => {
  it("es determinista: el mismo nombre siempre da el mismo color", () => {
    expect(getPaletteFromString("Mercadona")).toBe(getPaletteFromString("Mercadona"))
  })

  it("devuelve siempre una paleta de la lista", () => {
    for (const nombre of ["Mercadona", "Amazon", "", "Ω", "Ana Ruiz"]) {
      expect(AVATAR_PALETTES).toContain(getPaletteFromString(nombre))
    }
  })

  it("null y undefined se comportan como la cadena vacía", () => {
    expect(getPaletteFromString(null)).toBe(getPaletteFromString(""))
    expect(getPaletteFromString(undefined)).toBe(getPaletteFromString(""))
  })

  it("reparte: nombres distintos no caen todos en el mismo color", () => {
    const usados = new Set(
      ["Mercadona", "Amazon", "Carrefour", "Leroy Merlin", "Ana", "Luis", "Repsol", "Endesa"].map(
        (n) => getPaletteFromString(n).hex,
      ),
    )
    expect(usados.size).toBeGreaterThan(1)
  })
})

describe("isCustomEmoji", () => {
  it("un emoji fuera de los por defecto es propio", () => {
    expect(isCustomEmoji("🐧", ["🏢", "🧑"])).toBe(true)
  })

  it("uno de los por defecto no cuenta como elegido", () => {
    expect(isCustomEmoji("🏢", ["🏢", "🧑"])).toBe(false)
  })

  it("vacío o ausente no es propio", () => {
    expect(isCustomEmoji(null)).toBe(false)
    expect(isCustomEmoji(undefined)).toBe(false)
    expect(isCustomEmoji("")).toBe(false)
    expect(isCustomEmoji("   ")).toBe(false)
  })

  it("sin lista de por defecto, cualquier emoji es propio", () => {
    expect(isCustomEmoji("🏢")).toBe(true)
  })
})
