"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { parse, format } from "date-fns"
import * as XLSX from "xlsx"

import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase/client"
import type { Cuenta } from "@/lib/types/database"
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
    if (!/\.xls[x]?$/i.test(selectedFile.name)) {
      setError("Formato de archivo no soportado")
      setErrorCode("BAD_FORMAT")
      setFile(null)
      return
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
    
    const cleanValue = String(value).trim().replace(/\s/g, '')
    
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

  const handleImport = async () => {
    if (!file || !accountId || !source || source === "manual") return
    setIsImporting(true)
    setError(null)
    setErrorCode(null)
    setMessage(null)
    setProgress(0)
    setDuplicateCount(0)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { 
        type: "array",
        cellDates: true,  // Importante: convertir números seriales a fechas
        cellNF: false,    // No aplicar formato numérico automáticamente
        cellText: false   // No convertir todo a texto
      })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { 
        header: 1,
        raw: false,       // No usar valores raw, permitir conversión de tipos
        dateNF: 'dd/mm/yyyy' // Formato de fecha preferido
      }) as any[][]

      const parsed = source === "sabadell" ? parseSabadell(rows) : parseCaixabank(rows)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const toInsert: any[] = []
      let duplicates = 0
      const duplicateList: DuplicateTransaction[] = []
      
      for (let i = 0; i < parsed.length; i++) {
        const trx = parsed[i]
        toInsert.push({
          cuenta_id: accountId,
          fecha: trx.fecha,
          concepto: trx.concepto,
          descripcion: trx.descripcion,
          importe: trx.importe,
          ignorado: false,
          creado_por: user?.id || "",
        })
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
      
      const { error } = await supabase.from("movimiento").insert([{
        cuenta_id: accountId,
        fecha: transaction.fecha,
        concepto: transaction.concepto,
        descripcion: uniqueDescription,
        importe: transaction.importe,
        ignorado: false,
        creado_por: (await supabase.auth.getUser()).data?.user?.id || "",
      }])

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
              <div className={`flex items-center gap-2 ${file ? 'text-green-600' : source && (source === "caixabank" || source === "sabadell") ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${file ? 'bg-green-100 text-green-700' : source && (source === "caixabank" || source === "sabadell") ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                  {file ? '✓' : '2'}
                </div>
                <span>Subir archivo Excel</span>
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-amber-800">
                  ⚠️ Esta opción estará disponible próximamente
                </p>
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
          {source && (source === "caixabank" || source === "sabadell") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${file ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {file ? '✓' : '2'}
                </div>
                <Label className="text-base font-medium">Subir archivo Excel</Label>
              </div>

              <FileDropzone onFileChange={handleFileChange} />
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
            {source === "manual" ? (
              <div className="text-center space-y-2">
                <Button className="w-full" disabled>
                  Funcionalidad no disponible
                </Button>
                <p className="text-xs text-muted-foreground">
                  La importación manual estará disponible próximamente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(!file || !accountId) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800 text-sm">
                      <span>⚠️</span>
                      <span className="font-medium">Faltan campos requeridos:</span>
                    </div>
                    <ul className="mt-1 text-xs text-red-700 ml-6 list-disc">
                      {!file && <li>Debes subir un archivo Excel</li>}
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
            )}
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

