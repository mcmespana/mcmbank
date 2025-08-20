"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { parse, format } from "date-fns"
import * as XLSX from "xlsx"

import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase/client"
import type { Cuenta } from "@/lib/types/database"
import { useCategorias } from "@/hooks/use-categorias"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { FileDropzone } from "@/components/ui/file-dropzone"

interface TransactionImportPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Cuenta[]
  delegacionId: string | null
  onImported?: (importedCount?: number) => void
}

type SourceType = "manual" | "sabadell" | "caixabank"

interface ParsedTransaction {
  fecha: string
  concepto: string
  importe: number
  descripcion: string | null
  contraparte?: string | null
  categoria_id?: string | null
}

interface DuplicateTransaction extends ParsedTransaction {
  originalIndex: number
  isDuplicate: boolean
  conflictReason: string
}

export function TransactionImportPanel({
  open,
  onOpenChange,
  accounts,
  delegacionId,
  onImported,
}: TransactionImportPanelProps) {
  // Obtener las categorías disponibles para matching
  // Por ahora usaremos un valor predeterminado, pero deberíamos obtener el organizacion_id del delegacionId
  const { categorias: availableCategories } = useCategorias(delegacionId || undefined)
  
  const [source, setSource] = useState<SourceType | null>("manual")
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState<string>("")
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [duplicateTransactions, setDuplicateTransactions] = useState<DuplicateTransaction[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)
  
  // Ref para hacer scroll automático
  const sheetContentRef = useRef<HTMLDivElement>(null)

  // Función para hacer scroll al final del contenido
  const scrollToBottom = () => {
    if (sheetContentRef.current) {
      const element = sheetContentRef.current
      setTimeout(() => {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }

  // Hacer scroll automático cuando aparezcan mensajes de resultado
  useEffect(() => {
    if (!isImporting && (message || error || duplicateCount > 0)) {
      scrollToBottom()
    }
  }, [isImporting, message, error, duplicateCount])

  const resetState = () => {
    setSource("manual")
    setFile(null)
    setAccountId("")
    setIsImporting(false)
    setProgress(0)
    setError(null)
    setErrorCode(null)
    setMessage(null)
    setDuplicateCount(0)
    setDuplicateTransactions([])
    setShowDuplicates(false)
  }

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null)
      setError(null)
      setErrorCode(null)
      return
    }
    
    // Para Excel manual: permitir CSV, XLSX y XLS
    if (source === "manual") {
      if (!/\.(csv|xls[x]?)$/i.test(selectedFile.name)) {
        setError("Formato de archivo no soportado para Excel manual. Usa CSV, XLS o XLSX")
        setErrorCode("BAD_FORMAT")
        setFile(null)
        return
      }
    } else {
      // Para bancos: solo XLSX y XLS
      if (!/\.xls[x]?$/i.test(selectedFile.name)) {
        setError("Formato de archivo no soportado")
        setErrorCode("BAD_FORMAT")
        setFile(null)
        return
      }
    }
    
    setError(null)
    setErrorCode(null)
    setFile(selectedFile)
  }

  const formatConcept = (text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .map((w) =>
        w.length <= 2
          ? w.toLowerCase()
          : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
      .join(" ")
  }

  const parseEuropeanNumber = (value: string | number): number => {
    if (typeof value === 'number') return value
    
    // Limpiar el valor: quitar espacios, símbolos de euro, paréntesis, etc.
    let cleanValue = String(value).trim()
      .replace(/\s/g, '')                    // Quitar espacios
      .replace(/€/g, '')                     // Quitar símbolo de euro
      .replace(/[\(\)]/g, '')                // Quitar paréntesis (para números negativos)
      .replace(/^[\+\-]\s*/, (match) => match.replace(/\s/g, '')) // Mantener signo pero sin espacios
    
    // Si no tiene comas ni puntos, es un número entero
    if (!/[,.]/.test(cleanValue)) {
      return parseFloat(cleanValue)
    }
    
    // Contar comas y puntos
    const commaCount = (cleanValue.match(/,/g) || []).length
    const dotCount = (cleanValue.match(/\./g) || []).length
    
    let result: number
    
    if (commaCount === 0 && dotCount === 1) {
      // Solo punto: puede ser decimal inglés (1234.56) o miles español (1.234)
      const parts = cleanValue.split('.')
      if (parts[1].length <= 2) {
        // Probablemente decimal: 1234.56 → 1234.56
        result = parseFloat(cleanValue)
      } else {
        // Probablemente miles: 1.234 → 1234
        result = parseFloat(cleanValue.replace('.', ''))
      }
    } else if (dotCount === 0 && commaCount === 1) {
      // Solo coma: decimal español (270,41) → 270.41
      result = parseFloat(cleanValue.replace(',', '.'))
    } else if (commaCount === 1 && dotCount >= 1) {
      // Formato europeo: 1.234.567,89 → 1234567.89
      const lastCommaIndex = cleanValue.lastIndexOf(',')
      const beforeComma = cleanValue.substring(0, lastCommaIndex).replace(/\./g, '')
      const afterComma = cleanValue.substring(lastCommaIndex + 1)
      result = parseFloat(beforeComma + '.' + afterComma)
    } else if (dotCount === 1 && commaCount >= 1) {
      // Formato americano: 1,234,567.89 → 1234567.89
      const lastDotIndex = cleanValue.lastIndexOf('.')
      const beforeDot = cleanValue.substring(0, lastDotIndex).replace(/,/g, '')
      const afterDot = cleanValue.substring(lastDotIndex + 1)
      result = parseFloat(beforeDot + '.' + afterDot)
    } else {
      // Formato ambiguo, usar la estrategia más común (europeo)
      result = parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'))
    }
    
    return result
  }

  const parseSabadell = (rows: any[][]): ParsedTransaction[] => {
    const result: ParsedTransaction[] = []
    for (let i = 9; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue
      
      const dateStr = row[0]
      const conceptStr = row[1]
      const amountStr = row[3]
      
      // Saltar filas vacías o incompletas
      if (!dateStr || !conceptStr || amountStr === undefined || amountStr === null) continue
      
      // Verificar que no sean solo celdas vacías
      if (String(dateStr).trim() === '' || String(conceptStr).trim() === '' || String(amountStr).trim() === '') continue
      
      // Manejar fechas de Excel - pueden ser números seriales o texto
      let date: Date
      if (typeof dateStr === 'number') {
        // Convertir número serial de Excel a fecha
        date = new Date((dateStr - 25569) * 86400 * 1000)
      } else {
        // Intentar parsear como texto en varios formatos
        const dateString = String(dateStr).trim()
        if (dateString.includes('/')) {
          // Formato dd/MM/yyyy o d/M/yyyy
          date = parse(dateString, dateString.length <= 9 ? "d/M/yyyy" : "dd/MM/yyyy", new Date(), { locale: es })
        } else {
          date = new Date(dateString)
        }
      }
      
      if (isNaN(date.getTime())) {
        const err: any = new Error(`Fecha inválida: "${dateStr}" (fila ${i + 1})`)
        err.row = i + 1
        err.code = "INVALID_DATE"
        throw err
      }
      
      const importe = parseEuropeanNumber(amountStr)
      if (isNaN(importe)) {
        const err: any = new Error(`Importe inválido: "${amountStr}" (fila ${i + 1})`)
        err.row = i + 1
        err.code = "INVALID_AMOUNT"
        throw err
      }
      
      result.push({
        fecha: format(date, "yyyy-MM-dd"),
        concepto: formatConcept(String(conceptStr)),
        importe,
        descripcion: null,
      })
    }
    return result
  }

  const parseCaixabank = (rows: any[][]): ParsedTransaction[] => {
    const result: ParsedTransaction[] = []
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue
      
      const dateStr = row[0]
      const conceptStr = row[2]
      const descStr = row[3]
      const amountStr = row[4]
      const extra1 = row[5]
      const extra2 = row[6]
      
      // Saltar filas vacías o incompletas
      if (!dateStr || !conceptStr || amountStr === undefined || amountStr === null) continue
      
      // Verificar que no sean solo celdas vacías
      if (String(dateStr).trim() === '' || String(conceptStr).trim() === '' || String(amountStr).trim() === '') continue
      
      // Manejar fechas de Excel - pueden ser números seriales o texto
      let date: Date
      if (typeof dateStr === 'number') {
        // Convertir número serial de Excel a fecha
        date = new Date((dateStr - 25569) * 86400 * 1000)
      } else {
        // Intentar parsear como texto en varios formatos
        const dateString = String(dateStr).trim()
        if (dateString.includes('/')) {
          // Formato dd/MM/yyyy o d/M/yyyy
          date = parse(dateString, dateString.length <= 9 ? "d/M/yyyy" : "dd/MM/yyyy", new Date(), { locale: es })
        } else {
          date = new Date(dateString)
        }
      }
      
      if (isNaN(date.getTime())) {
        const err: any = new Error(`Fecha inválida: "${dateStr}" (fila ${i + 1})`)
        err.row = i + 1
        err.code = "INVALID_DATE"
        throw err
      }
      
      const importe = parseEuropeanNumber(amountStr)
      if (isNaN(importe)) {
        const err: any = new Error(`Importe inválido: "${amountStr}" (fila ${i + 1})`)
        err.row = i + 1
        err.code = "INVALID_AMOUNT"
        throw err
      }
      
      const extras = [extra1, extra2]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => v !== "" && !/^\d+$/.test(v))
      const descripcion = [descStr, extras.join("\n")].filter(Boolean).join("\n")
      result.push({
        fecha: format(date, "yyyy-MM-dd"),
        concepto: formatConcept(String(conceptStr)),
        importe,
        descripcion: descripcion || null,
      })
    }
    return result
  }

  const parseManual = (rows: any[][]): ParsedTransaction[] => {
    const result: ParsedTransaction[] = []
    const skippedRows: number[] = []
    let categoriesFound = 0
    let categoriesNotFound: string[] = []
    
    // Saltar la primera fila que contiene los headers
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue
      
      const dateStr = row[0]  // Fecha
      const conceptStr = row[1]  // Concepto
      const amountStr = row[2]  // Importe
      const descStr = row[3]  // Descripción (Opcional)
      const categoryStr = row[4]  // Categoría (Opcional)
      const contactStr = row[5]  // Contacto (Opcional)
      
      // Verificar que tenemos fecha e importe (campos obligatorios)
      if (!dateStr || !amountStr || 
          String(dateStr).trim() === '' || String(amountStr).trim() === '') {
        skippedRows.push(i + 1)
        continue
      }
      
      // Manejar fechas de Excel - pueden ser números seriales o texto
      let date: Date
      if (typeof dateStr === 'number') {
        // Convertir número serial de Excel a fecha
        date = new Date((dateStr - 25569) * 86400 * 1000)
      } else {
        // Intentar parsear como texto en varios formatos
        const dateString = String(dateStr).trim()
        if (dateString.includes('/')) {
          // Formato dd/MM/yyyy o d/M/yyyy
          date = parse(dateString, dateString.length <= 9 ? "d/M/yyyy" : "dd/MM/yyyy", new Date(), { locale: es })
        } else {
          date = new Date(dateString)
        }
      }
      
      if (isNaN(date.getTime())) {
        skippedRows.push(i + 1)
        continue
      }
      
      const importe = parseEuropeanNumber(amountStr)
      if (isNaN(importe)) {
        skippedRows.push(i + 1)
        continue
      }
      
      // Si no hay concepto, usar "SIN NOMBRE"
      const concepto = conceptStr && String(conceptStr).trim() !== '' 
        ? formatConcept(String(conceptStr)) 
        : "SIN NOMBRE"
      
      // Procesar contacto (contraparte)
      const contraparte = contactStr && String(contactStr).trim() !== '' 
        ? String(contactStr).trim() 
        : null
      
      // Procesar categoría - buscar coincidencia exacta por nombre
      let categoria_id: string | null = null
      let categoriaEnDescripcion: string | null = null
      
      if (categoryStr && String(categoryStr).trim() !== '') {
        const categoryName = String(categoryStr).trim()
        const matchingCategory = availableCategories?.find(
          cat => cat.nombre.toLowerCase() === categoryName.toLowerCase()
        )
        
        if (matchingCategory) {
          categoria_id = matchingCategory.id
          categoriesFound++
        } else {
          // Si no encontramos la categoría, añadirla a la descripción
          categoriaEnDescripcion = `Categoría de importación: ${categoryName}`
          if (!categoriesNotFound.includes(categoryName)) {
            categoriesNotFound.push(categoryName)
          }
        }
      }
      
      // Combinar descripción opcional con otros campos
      const extraFields = [
        descStr && String(descStr).trim() !== '' ? String(descStr).trim() : null,
        categoriaEnDescripcion,
      ].filter(Boolean)
      
      const descripcion = extraFields.length > 0 ? extraFields.join('\n') : null
      
      result.push({
        fecha: format(date, "yyyy-MM-dd"),
        concepto,
        importe,
        descripcion,
        contraparte,
        categoria_id,
      })
    }
    
    // Mostrar información sobre el procesamiento
    if (skippedRows.length > 0) {
      console.log(`ℹ️ Se omitieron ${skippedRows.length} filas por falta de fecha o importe: ${skippedRows.join(', ')}`)
    }
    
    if (categoriesFound > 0) {
      console.log(`✅ Se encontraron y asignaron ${categoriesFound} categorías automáticamente`)
    }
    
    if (categoriesNotFound.length > 0) {
      console.log(`⚠️ Categorías no encontradas (se añadieron a descripción): ${categoriesNotFound.join(', ')}`)
    }
    
    return result
  }

  const handleImport = async () => {
    if (!file || !accountId || !source) return
    setIsImporting(true)
    setError(null)
    setErrorCode(null)
    setMessage(null)
    setProgress(0)
    setDuplicateCount(0)

    try {
      let rows: any[][]
      
      // Manejar archivos CSV de manera diferente
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        // Parsear CSV simple (asumiendo separador por comas)
        const lines = text.split('\n')
        rows = lines.map(line => {
          // Parseo simple de CSV - podrías usar una librería más robusta si es necesario
          const cells: string[] = []
          let currentCell = ''
          let inQuotes = false
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              cells.push(currentCell.trim())
              currentCell = ''
            } else {
              currentCell += char
            }
          }
          cells.push(currentCell.trim()) // Añadir la última celda
          return cells
        }).filter(row => row.some(cell => cell.length > 0)) // Filtrar filas completamente vacías
      } else {
        // Manejar archivos Excel (XLSX/XLS)
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { 
          type: "array",
          cellDates: true,  // Importante: convertir números seriales a fechas
          cellNF: false,    // No aplicar formato numérico automáticamente
          cellText: false   // No convertir todo a texto
        })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json<any[]>(sheet, { 
          header: 1,
          raw: false,       // No usar valores raw, permitir conversión de tipos
          dateNF: 'dd/mm/yyyy' // Formato de fecha preferido
        }) as any[][]
      }

      let parsed: ParsedTransaction[]
      if (source === "manual") {
        parsed = parseManual(rows)
      } else if (source === "sabadell") {
        parsed = parseSabadell(rows)
      } else {
        parsed = parseCaixabank(rows)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const toInsert: any[] = []
      let duplicates = 0
      const duplicateList: DuplicateTransaction[] = []
      
      for (let i = 0; i < parsed.length; i++) {
        const trx = parsed[i]
        const insertData: any = {
          cuenta_id: accountId,
          fecha: trx.fecha,
          concepto: trx.concepto,
          descripcion: trx.descripcion,
          importe: trx.importe,
          ignorado: false,
          creado_por: user?.id || "",
        }
        
        // Añadir contraparte y categoria_id solo para importación manual
        if (source === "manual") {
          if (trx.contraparte) {
            insertData.contraparte = trx.contraparte
          }
          if (trx.categoria_id) {
            insertData.categoria_id = trx.categoria_id
          }
        }
        
        toInsert.push(insertData)
        setProgress(Math.round(((i + 1) / parsed.length) * 100))
      }

      if (toInsert.length > 0) {
        // Intentar insertar todas las transacciones de una vez
        const { data: insertedData, error: insertError } = await supabase
          .from("movimiento")
          .insert(toInsert)
          .select('id')

        if (insertError) {
          // Si hay error de duplicados, analizar uno por uno
          if (insertError.code === '23505' && insertError.message.includes('ux_mov_dedupe')) {
            let successCount = 0
            duplicates = 0
            
            for (let i = 0; i < toInsert.length; i++) {
              const transaction = toInsert[i]
              const originalTrx = parsed[i]
              
              const { error: singleError } = await supabase
                .from("movimiento")
                .insert([transaction])
              
              if (singleError) {
                if (singleError.code === '23505' && singleError.message.includes('ux_mov_dedupe')) {
                  duplicates++
                  
                  // Buscar el movimiento existente para mostrar detalles
                  const { data: existingData } = await supabase
                    .from("movimiento")
                    .select('*')
                    .eq('cuenta_id', accountId)
                    .eq('fecha', originalTrx.fecha)
                    .eq('importe', originalTrx.importe)
                    .eq('concepto', originalTrx.concepto)
                    .eq('descripcion', originalTrx.descripcion || null)
                    .limit(1)
                  
                  let conflictReason = "Transacción idéntica ya existe"
                  if (existingData && existingData.length > 0) {
                    const existing = existingData[0]
                    if (existing.descripcion !== originalTrx.descripcion) {
                      conflictReason = `Descripción diferente: "${existing.descripcion}" vs "${originalTrx.descripcion}"`
                    }
                  }
                  
                  duplicateList.push({
                    ...originalTrx,
                    originalIndex: i,
                    isDuplicate: true,
                    conflictReason
                  })
                } else {
                  // Error diferente, relanzar
                  throw singleError
                }
              } else {
                successCount++
              }
            }
            
            setDuplicateCount(duplicates)
            setDuplicateTransactions(duplicateList)
            
            if (duplicates > 0) {
              setMessage(`Se han importado ${successCount} transacciones. ${duplicates} posibles duplicados detectados.`)
            } else {
              setMessage(`Se han importado ${successCount} transacciones`)
            }
            
            // Llamar a onImported si se importaron transacciones exitosamente
            if (successCount > 0 && onImported) {
              console.log(`✅ Importación completada: ${successCount} transacciones`)
              setTimeout(() => onImported(successCount), 500) // Pequeño delay para asegurar que la DB esté actualizada
            }
          } else {
            // Error diferente, relanzar
            throw insertError
          }
        } else {
          // Todas las transacciones se insertaron correctamente
          const insertCount = insertedData?.length || toInsert.length
          setMessage(`Se han importado ${insertCount} transacciones`)
          
          // Llamar a onImported si se importaron transacciones exitosamente
          if (insertCount > 0 && onImported) {
            console.log(`✅ Importación masiva completada: ${insertCount} transacciones`)
            setTimeout(() => onImported(insertCount), 500) // Pequeño delay para asegurar que la DB esté actualizada
          }
        }
      } else {
        setMessage(`No se encontraron transacciones para importar`)
      }
    } catch (err: any) {
      console.error('Error durante la importación:', err)
      setError(err.row ? `Problema con la fila ${err.row}: ${err.message}` : err.message)
      setErrorCode(err.code || "UNKNOWN")
    } finally {
      setIsImporting(false)
      setProgress(100)
    }
  }

  const handleForceDuplicate = async (transactionIndex: number) => {
    const transaction = duplicateTransactions[transactionIndex]
    if (!transaction || !accountId) return

    try {
      // Agregar un timestamp único a la descripción para evitar el conflicto de duplicados
      const uniqueDescription = `${transaction.descripcion || ''}\n[Posible duplicado - Importación forzada el ${new Date().toISOString()}]`
      
      const insertData: any = {
        cuenta_id: accountId,
        fecha: transaction.fecha,
        concepto: transaction.concepto,
        descripcion: uniqueDescription,
        importe: transaction.importe,
        ignorado: false,
        creado_por: (await supabase.auth.getUser()).data?.user?.id || "",
      }

      // Añadir contraparte y categoria_id si están disponibles (para importación manual)
      if (transaction.contraparte) {
        insertData.contraparte = transaction.contraparte
      }
      if (transaction.categoria_id) {
        insertData.categoria_id = transaction.categoria_id
      }
      
      const { error } = await supabase.from("movimiento").insert([insertData])

      if (error) {
        setError(`Error al forzar inserción: ${error.message}`)
      } else {
        // Remover de la lista de duplicados
        const newDuplicates = duplicateTransactions.filter((_, i) => i !== transactionIndex)
        setDuplicateTransactions(newDuplicates)
        setDuplicateCount(newDuplicates.length)
        
        if (newDuplicates.length === 0) {
          setShowDuplicates(false)
          setMessage(message + " Todos los duplicados han sido procesados.")
        }
        
        // Actualizar las transacciones en el fondo
        console.log(`✅ Duplicado forzado importado`)
        setTimeout(() => {
          if (onImported) onImported(1)
        }, 500)
      }
    } catch (err: any) {
      setError(`Error al forzar inserción: ${err.message}`)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) resetState()
      }}
    >
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" ref={sheetContentRef}>
        <SheetHeader className="space-y-3 pb-6 border-b">
          <SheetTitle className="text-xl">Importar transacciones</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Progress Steps */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Pasos para importar:</h3>
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${source ? 'text-green-600' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${source ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {source ? '✓' : '1'}
                </div>
                <span>Seleccionar origen de datos</span>
              </div>
              <div className={`flex items-center gap-2 ${file ? 'text-green-600' : source && (source === "caixabank" || source === "sabadell" || source === "manual") ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${file ? 'bg-green-100 text-green-700' : source && (source === "caixabank" || source === "sabadell" || source === "manual") ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                  {file ? '✓' : '2'}
                </div>
                <span>{source === "manual" ? "Subir archivo (CSV/Excel)" : "Subir archivo Excel"}</span>
              </div>
              <div className={`flex items-center gap-2 ${accountId ? 'text-green-600' : source ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${accountId ? 'bg-green-100 text-green-700' : source ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                  {accountId ? '✓' : '3'}
                </div>
                <span>Seleccionar cuenta de destino</span>
              </div>
            </div>
          </div>

          {/* Source Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${source ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {source ? '✓' : '1'}
              </div>
              <Label className="text-base font-medium">Origen de los datos</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSource("manual")}
                className={`border rounded-md p-2 text-sm hover:bg-muted flex flex-col items-center gap-1 ${
                  source === "manual" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Image src="/bank-logos/excel.png" alt="Excel" width={32} height={32} />
                <span>Excel manual</span>
              </button>
              <button
                type="button"
                onClick={() => setSource("sabadell")}
                className={`border rounded-md p-2 text-sm hover:bg-muted flex flex-col items-center gap-1 ${
                  source === "sabadell" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Image src="/bank-logos/sabadell.png" alt="Sabadell" width={32} height={32} />
                <span>Sabadell</span>
              </button>
              <button
                type="button"
                onClick={() => setSource("caixabank")}
                className={`border rounded-md p-2 text-sm hover:bg-muted flex flex-col items-center gap-1 ${
                  source === "caixabank" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Image src="/bank-logos/caixabank.png" alt="Caixabank" width={32} height={32} />
                <span>Caixabank</span>
              </button>
            </div>
            {source === "manual" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3 space-y-3">
                <p className="text-sm text-blue-800">
                  • Usa la plantilla de importación disponible en Google Drive<br />
                  • Expórtala en CSV o XLSX y súbela<br />
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1lf9AHxgkjKKXacT2BwGrpMMPvM2bfvRUUEsa2BykX20/edit?usp=sharing', '_blank')}
                  className="w-full text-xs"
                >
                  📊 Descargar plantilla de Google Drive
                </Button>
              </div>
            )}
            {(source === "caixabank" || source === "sabadell") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-blue-800">
                  • Sube el Excel extraído banco<br />
                  • Se importarán todas las filas del Excel<br />
                  • Se eliminarán duplicados automáticamente<br />
                  • No modifiques la estructura del archivo 🙅🏻
                </p>
              </div>
            )}
          </div>

          {/* File Upload Section */}
          {source && (source === "caixabank" || source === "sabadell" || source === "manual") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${file ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {file ? '✓' : '2'}
                </div>
                <Label className="text-base font-medium">
                  {source === "manual" ? "Subir archivo (CSV, XLSX o XLS)" : "Subir archivo Excel"}
                </Label>
              </div>

              <FileDropzone 
                onFileChange={handleFileChange}
                accept={source === "manual" ? {
                  "text/csv": [".csv"],
                  "application/vnd.ms-excel": [".xls"],
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                } : {
                  "application/vnd.ms-excel": [".xls"],
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                }}
                formatInfo={source === "manual" ? "Compatible con .csv, .xls y .xlsx" : "Compatible con .xls y .xlsx"}
              />
            </div>
          )}

          {/* Account Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${accountId ? 'bg-green-100 text-green-700' : source ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                {accountId ? '✓' : '3'}
              </div>
              <Label className="text-base font-medium">Cuenta de destino</Label>
              {!accountId && source && <span className="text-xs text-red-500 font-medium">* Requerido</span>}
            </div>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className={!accountId && source ? 'border-red-200 focus:border-red-300' : ''}>
                <SelectValue placeholder="⚠️ Selecciona una cuenta para continuar" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import Button */}
          <div className="pt-6 border-t">
            <div className="space-y-3">
              {(!file || !accountId) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-800 text-sm">
                    <span>⚠️</span>
                    <span className="font-medium">Faltan campos requeridos:</span>
                  </div>
                  <ul className="mt-1 text-xs text-red-700 ml-6 list-disc">
                    {!file && <li>Debes subir un archivo {source === "manual" ? "(CSV/Excel)" : "Excel"}</li>}
                    {!accountId && <li>Debes seleccionar una cuenta de destino</li>}
                  </ul>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleImport}
                disabled={!file || !accountId || !source || isImporting}
              >
                {isImporting ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Importando... {progress}%</span>
                  </div>
                ) : (
                  `Importar transacciones${file && accountId ? ' ✓' : ''}`
                )}
              </Button>
            </div>
          </div>

          {/* Status Messages */}
          {!isImporting && message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium">✅ {message}</p>
            </div>
          )}
          {duplicateCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-amber-800">
                  ⚠️ {duplicateCount} posibles duplicados detectados
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                >
                  {showDuplicates ? 'Ocultar' : 'Ver'} duplicados
                </Button>
              </div>
              
              {showDuplicates && duplicateTransactions.length > 0 && (
                <div className="space-y-2 mt-3 border-t border-amber-200 pt-3">
                  <p className="text-xs text-amber-700 font-medium">Transacciones duplicadas encontradas:</p>
                  {duplicateTransactions.map((dup, index) => (
                    <div key={index} className="bg-white border border-amber-200 rounded p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-medium">Fecha:</span> {dup.fecha}
                        </div>
                        <div>
                          <span className="font-medium">Importe:</span> €{dup.importe}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Concepto:</span> {dup.concepto}
                        </div>
                        {dup.descripcion && (
                          <div className="col-span-2">
                            <span className="font-medium">Descripción:</span> 
                            <div className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                              {dup.descripcion}
                            </div>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="font-medium text-amber-700">Conflicto:</span> 
                          <span className="text-amber-600 text-xs"> {dup.conflictReason}</span>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleForceDuplicate(index)}
                          className="text-xs"
                        >
                          Importar de todas formas
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm text-red-800 space-y-1">
                <p className="font-medium">❌ Error: {error}</p>
                {errorCode && <code className="text-xs bg-red-100 px-1 py-0.5 rounded">{errorCode}</code>}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

