import { describe, it, expect } from "vitest"
import { parseImportDate, parseCsv } from "@/lib/utils/import-parsing"

describe("parseImportDate", () => {
  it("Excel serial 46096 (2026-03-15) -> 2026-03-15", () => {
    expect(parseImportDate(46096)).toBe("2026-03-15")
  })

  it("Excel serial fraccionario (parte de hora) se redondea al día correcto", () => {
    expect(parseImportDate(46096.25)).toBe("2026-03-15")
  })

  it("d/M/yyyy (un dígito) -> yyyy-MM-dd", () => {
    expect(parseImportDate("15/3/2026")).toBe("2026-03-15")
  })

  it("dd/MM/yyyy (dos dígitos) -> yyyy-MM-dd", () => {
    expect(parseImportDate("05/03/2026")).toBe("2026-03-05")
  })

  it("yyyy-MM-dd se devuelve sin cambios", () => {
    expect(parseImportDate("2026-03-15")).toBe("2026-03-15")
  })

  it("yyyy-MM-dd con sufijo de hora conserva solo la fecha", () => {
    expect(parseImportDate("2026-03-15T10:00:00Z")).toBe("2026-03-15")
  })

  it("fecha inválida con formato dd/MM/yyyy lanza INVALID_DATE (31/02)", () => {
    expect(() => parseImportDate("31/02/2026")).toThrowError(
      expect.objectContaining({ code: "INVALID_DATE" }),
    )
  })

  it("texto no reconocible lanza INVALID_DATE", () => {
    expect(() => parseImportDate("no-es-una-fecha")).toThrowError(
      expect.objectContaining({ code: "INVALID_DATE" }),
    )
  })

})

describe("parseCsv", () => {
  it("separa filas por comas", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("respeta comas dentro de un campo entrecomillado", () => {
    expect(parseCsv('15/03/2026,"Pago, con coma",100')).toEqual([
      ["15/03/2026", "Pago, con coma", "100"],
    ])
  })

  it("filtra filas completamente vacías", () => {
    expect(parseCsv("a,b\n\n,\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })

  it("característica conocida y aceptada: no soporta saltos de línea dentro de un campo entrecomillado", () => {
    // El campo entrecomillado se corta en el salto de línea real, partiendo
    // el registro en dos filas; además el estado de "dentro de comillas" no
    // persiste entre líneas, así que la coma de la segunda línea deja de
    // tratarse como separador — comportamiento heredado, no un fix.
    const result = parseCsv('1,"linea uno\nlinea dos",3')
    expect(result).toEqual([
      ["1", "linea uno"],
      ["linea dos,3"],
    ])
  })
})
