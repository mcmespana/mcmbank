import { describe, it, expect } from "vitest"
import {
  CONTACTO_TIPOS,
  archivadoEfectivoContacto,
  categoriaPredeterminadaEfectiva,
  nombreEfectivoContacto,
  notasEfectivasContacto,
  type ContactoConCategoriaPredeterminada,
} from "@/lib/types/database"
import {
  CONTACTO_TIPO_INFO,
  CONTACTO_TIPO_ORDER,
  getContactoTipoInfo,
  getDefaultColor,
  getDefaultEmoji,
} from "@/lib/utils/contacto-tipos"

/**
 * Los proveedores son fichas de toda la organización y cada delegación las
 * adopta con sus propios ajustes. Leer el campo de la ficha en vez del
 * efectivo se salta esa sobrescritura: archivar Mercadona en Castellón se lo
 * quitaría a Sevilla. Esto lo blinda.
 */
const base = (over: Partial<ContactoConCategoriaPredeterminada> = {}) =>
  ({
    id: "p1",
    nombre: "Mercadona",
    archivado: false,
    notas: "Notas de la ficha",
    categoria_id_predeterminada: "cat-ficha",
    adopcion: null,
    ...over,
  }) as ContactoConCategoriaPredeterminada

const adopcion = (over: Record<string, unknown> = {}) => ({
  delegacion_id: "d1",
  alias: null,
  notas: null,
  categoria_id_predeterminada: null,
  archivado: false,
  ...over,
})

describe("nombreEfectivoContacto", () => {
  it("sin adopción, el nombre de la ficha", () => {
    expect(nombreEfectivoContacto(base())).toBe("Mercadona")
  })

  it("el alias de la delegación manda", () => {
    expect(nombreEfectivoContacto(base({ adopcion: adopcion({ alias: "Merca del barrio" }) as any }))).toBe(
      "Merca del barrio",
    )
  })

  it("un alias en blanco no tapa el nombre real", () => {
    expect(nombreEfectivoContacto(base({ adopcion: adopcion({ alias: "   " }) as any }))).toBe(
      "Mercadona",
    )
  })
})

describe("archivadoEfectivoContacto", () => {
  it("para un contacto propio manda la ficha", () => {
    expect(archivadoEfectivoContacto(base({ archivado: true }))).toBe(true)
  })

  it("para uno adoptado manda la adopción, no la ficha", () => {
    // Archivado globalmente pero activo aquí: se sigue viendo en esta delegación.
    expect(
      archivadoEfectivoContacto(base({ archivado: true, adopcion: adopcion() as any })),
    ).toBe(false)
    // Y al revés: archivarlo aquí no depende de la ficha compartida.
    expect(
      archivadoEfectivoContacto(base({ archivado: false, adopcion: adopcion({ archivado: true }) as any })),
    ).toBe(true)
  })
})

describe("categoriaPredeterminadaEfectiva", () => {
  it("la de la delegación gana", () => {
    expect(
      categoriaPredeterminadaEfectiva(
        base({ adopcion: adopcion({ categoria_id_predeterminada: "cat-deleg" }) as any }),
      ),
    ).toBe("cat-deleg")
  })

  it("si la adopción no la fija, cae a la de la ficha", () => {
    expect(categoriaPredeterminadaEfectiva(base({ adopcion: adopcion() as any }))).toBe("cat-ficha")
  })

  it("sin ninguna de las dos, null", () => {
    expect(categoriaPredeterminadaEfectiva(base({ categoria_id_predeterminada: null }))).toBeNull()
  })
})

describe("notasEfectivasContacto", () => {
  it("las notas de la delegación tapan las de la ficha", () => {
    expect(notasEfectivasContacto(base({ adopcion: adopcion({ notas: "Pagan a 30 días" }) as any }))).toBe(
      "Pagan a 30 días",
    )
  })

  it("sin notas propias se ven las compartidas", () => {
    expect(notasEfectivasContacto(base({ adopcion: adopcion() as any }))).toBe("Notas de la ficha")
  })
})

describe("catálogo de tipos de contacto", () => {
  it("hay información completa para los tres tipos", () => {
    for (const tipo of CONTACTO_TIPOS) {
      const info = getContactoTipoInfo(tipo)
      expect(info.value).toBe(tipo)
      expect(info.label.length).toBeGreaterThan(0)
      expect(info.descripcion.length).toBeGreaterThan(0)
      expect(getDefaultEmoji(tipo)).toBe(info.emoji)
      expect(getDefaultColor(tipo)).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it("el orden de la UI cubre exactamente los tipos existentes", () => {
    expect([...CONTACTO_TIPO_ORDER].sort()).toEqual([...CONTACTO_TIPOS].sort())
    expect(Object.keys(CONTACTO_TIPO_INFO).sort()).toEqual([...CONTACTO_TIPOS].sort())
  })

  it("cada tipo tiene su propio emoji y color, para poder distinguirlos de un vistazo", () => {
    const emojis = new Set(CONTACTO_TIPOS.map(getDefaultEmoji))
    const colores = new Set(CONTACTO_TIPOS.map(getDefaultColor))
    expect(emojis.size).toBe(CONTACTO_TIPOS.length)
    expect(colores.size).toBe(CONTACTO_TIPOS.length)
  })
})
