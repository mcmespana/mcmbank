import type { MovimientoDeSubvencion } from "@/lib/services/subvenciones"
import type { Subvencion } from "@/lib/types/database"
import { formatDate } from "@/lib/utils/format"

/**
 * Excel de los movimientos de una subvención. La primera columna es el id del
 * movimiento a propósito: es lo que se pega en la API (`/api/v1/movimientos/:id`)
 * o en el Excel de justificación para traer facturas y archivos.
 */
export async function exportarMovimientosSubvencion(
  subvencion: Pick<Subvencion, "nombre">,
  movimientos: MovimientoDeSubvencion[],
) {
  // `@e965/xlsx`, no `xlsx` (ver lib/utils/export-to-excel.ts).
  const XLSX = await import("@e965/xlsx")

  const filas = movimientos.map((m) => ({
    ID: m.id,
    Fecha: formatDate(m.fecha),
    Delegación: m.delegacion?.nombre ?? "",
    Cuenta: m.cuenta?.nombre ?? "",
    Concepto: m.concepto,
    Contacto: m.contacto?.nombre ?? "",
    Categoría: m.categoria?.nombre ?? "",
    Importe: m.importe,
    Factura: m.factura_id ? "Sí" : m.factura_pendiente ? "Falta" : "",
    Archivos: m.archivos,
  }))

  const hoja = XLSX.utils.json_to_sheet(filas)
  hoja["!cols"] = [
    { wch: 38 },
    { wch: 11 },
    { wch: 18 },
    { wch: 18 },
    { wch: 40 },
    { wch: 24 },
    { wch: 20 },
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
  ]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Movimientos")

  const nombre = subvencion.nombre.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80)
  XLSX.writeFile(libro, `Subvención ${nombre}.xlsx`)
}
