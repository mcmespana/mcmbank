import * as XLSX from "xlsx"
import { format, parse } from "date-fns"

export interface ImportedTransaction {
  fecha: string
  concepto: string
  descripcion?: string
  importe: number
}

export class RowParseError extends Error {
  row: number
  code: string
  constructor(message: string, row: number, code: string) {
    super(message)
    this.row = row
    this.code = code
    this.name = "RowParseError"
  }
}

const normalizeConcept = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")

const parseImporte = (value: any): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(/,/g, ".")
    const num = parseFloat(cleaned)
    if (!isNaN(num)) return num
  }
  return NaN
}

export function parseSabadell(buffer: ArrayBuffer): ImportedTransaction[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: "A", raw: false })
  const data = rows.slice(8) // start from row 9
  const result: ImportedTransaction[] = []

  data.forEach((row, idx) => {
    const excelRow = idx + 9
    if (!row.A && !row.B && !row.D) return
    const fechaVal = row.A
    const conceptoVal = row.B
    const importeVal = row.D

    if (!fechaVal || !conceptoVal || importeVal === undefined) {
      throw new RowParseError("Fila incompleta", excelRow, "SBD_INCOMPLETE")
    }

    const fecha = typeof fechaVal === "object"
      ? format(fechaVal as Date, "yyyy-MM-dd")
      : format(parse(String(fechaVal), "dd/MM/yyyy", new Date()), "yyyy-MM-dd")

    const importe = parseImporte(importeVal)
    if (isNaN(importe)) {
      throw new RowParseError("Importe inválido", excelRow, "SBD_AMOUNT")
    }

    result.push({
      fecha,
      concepto: normalizeConcept(String(conceptoVal)),
      importe,
    })
  })

  return result
}

export function parseCaixabank(buffer: ArrayBuffer): ImportedTransaction[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: "A", raw: false })
  const data = rows.slice(3) // start from row 4
  const result: ImportedTransaction[] = []

  data.forEach((row, idx) => {
    const excelRow = idx + 4
    if (!row.A && !row.C && !row.E) return
    const fechaVal = row.A
    const conceptoVal = row.C
    const descVal = row.D
    const importeVal = row.E
    const extra1 = row.F
    const extra2 = row.G

    if (!fechaVal || !conceptoVal || importeVal === undefined) {
      throw new RowParseError("Fila incompleta", excelRow, "CXB_INCOMPLETE")
    }

    const fecha = typeof fechaVal === "object"
      ? format(fechaVal as Date, "yyyy-MM-dd")
      : format(parse(String(fechaVal), "dd/M/yyyy", new Date()), "yyyy-MM-dd")

    const importe = parseImporte(importeVal)
    if (isNaN(importe)) {
      throw new RowParseError("Importe inválido", excelRow, "CXB_AMOUNT")
    }

    const extras = [extra1, extra2].filter((t) => typeof t === "string" && !/^\d+$/.test(t))
    const descripcionParts = [] as string[]
    if (descVal) descripcionParts.push(String(descVal))
    if (extras.length) descripcionParts.push(extras.join("\n"))
    const descripcion = descripcionParts.length ? descripcionParts.join("\n") : undefined

    result.push({
      fecha,
      concepto: normalizeConcept(String(conceptoVal)),
      descripcion,
      importe,
    })
  })

  return result
}
