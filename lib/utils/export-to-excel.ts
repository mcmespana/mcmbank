import type { MovimientoConRelaciones, Cuenta, Categoria } from "@/lib/types/database"
import { formatDate } from "./format"

export async function exportMovementsToExcel(
  movements: MovimientoConRelaciones[],
  accounts: Cuenta[],
  categories: Categoria[],
) {
  try {
    // @ts-ignore - optional dependency
    const XLSX = await import("xlsx")

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
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    
    // Configurar anchos de columnas
    const columnWidths = [
      { wch: 12 }, // Fecha
      { wch: 20 }, // Cuenta
      { wch: 30 }, // Concepto
      { wch: 15 }, // Categoría
      { wch: 12 }, // Importe
      { wch: 25 }, // Descripción
      { wch: 20 }, // Contacto
    ]
    worksheet['!cols'] = columnWidths

    // Aplicar estilos a los encabezados (primera fila)
    const headerStyle = {
      font: { bold: true, sz: 12 },
      fill: { patternType: "solid", fgColor: { rgb: "D9E1F2" } },
      alignment: { 
        horizontal: "center", 
        vertical: "center", 
        wrapText: true 
      },
      border: {
        top: { style: "medium" },
        bottom: { style: "medium" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    }

    // Aplicar estilos a las celdas de datos
    const dataStyle = {
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      },
      alignment: { 
        vertical: "top", 
        wrapText: true 
      }
    }

    // Aplicar estilos a los encabezados (A1:G1)
    const headers = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1']
    headers.forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = headerStyle
      }
    })

    // Aplicar estilos a las celdas de datos
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:G1')
    for (let row = 2; row <= range.e.r + 1; row++) {
      for (let col = 0; col <= 6; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col })
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = { ...dataStyle }
          
          // Alineación especial para la columna de importe (derecha)
          if (col === 4) { // Columna E (Importe)
            worksheet[cellAddress].s.alignment = { 
              horizontal: "right", 
              vertical: "top", 
              wrapText: true 
            }
          }
        }
      }
    }

    // Configurar altura mínima de filas para que se vea bien el texto ajustado
    worksheet['!rows'] = []
    for (let i = 0; i <= range.e.r; i++) {
      worksheet['!rows'][i] = { hpt: i === 0 ? 25 : 20 } // Header más alto
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transacciones")
    const fileName = `transacciones-${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  } catch (error) {
    console.error("Excel export failed", error)
    throw error
  }
}
