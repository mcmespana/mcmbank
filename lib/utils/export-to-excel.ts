import type { MovimientoConRelaciones, Cuenta, Categoria } from "@/lib/types/database"
import { formatDate } from "./format"

export async function exportMovementsToExcel(
  movements: MovimientoConRelaciones[],
  accounts: Cuenta[],
  categories: Categoria[],
) {
  try {
    // @ts-ignore - optional dependency
    const XLSX = (await import("xlsx")).default

    const data = movements.map((m) => ({
      Fecha: formatDate(m.fecha),
      Cuenta:
        m.cuenta?.nombre || accounts.find((a) => a.id === m.cuenta_id)?.nombre || "",
      Concepto: m.concepto,
      Categoría:
        m.categoria?.nombre ||
        categories.find((c) => c.id === m.categoria_id)?.nombre ||
        "",
      Importe: m.importe,
      Descripción: m.descripcion ?? "",
      Contacto: m.contraparte ?? "",
      Método: m.metodo ?? "",
      Notas: m.notas ?? "",
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transacciones")
    const fileName = `transacciones-${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  } catch (error) {
    console.error("Excel export failed", error)
    throw error
  }
}
