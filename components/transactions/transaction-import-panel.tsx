"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface TransactionImportPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Cuenta[]
  delegacionId: string | null
  onImported?: () => void
}

type SourceType = "manual" | "sabadell" | "caixabank"

interface ParsedTransaction {
  fecha: string
  concepto: string
  importe: number
  descripcion: string | null
}

export function TransactionImportPanel({
  open,
  onOpenChange,
  accounts,
  delegacionId,
  onImported,
}: TransactionImportPanelProps) {
  const [source, setSource] = useState<SourceType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState<string>("")
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)

  const resetState = () => {
    setSource(null)
    setFile(null)
    setAccountId("")
    setIsImporting(false)
    setProgress(0)
    setError(null)
    setErrorCode(null)
    setMessage(null)
    setDuplicateCount(0)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/\.xls[x]?$/i.test(f.name)) {
      setError("Formato de archivo no soportado")
      setErrorCode("BAD_FORMAT")
      return
    }
    setError(null)
    setErrorCode(null)
    setFile(f)
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

  const parseSabadell = (rows: any[][]): ParsedTransaction[] => {
    const result: ParsedTransaction[] = []
    for (let i = 8; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const dateStr = row[0]
      const conceptStr = row[1]
      const amountStr = row[3]
      if (!dateStr || !conceptStr || !amountStr) continue
      const date = parse(String(dateStr), "dd/MM/yyyy", new Date(), { locale: es })
      if (isNaN(date.getTime())) {
        const err: any = new Error("Fecha inválida")
        err.row = i + 1
        err.code = "INVALID_DATE"
        throw err
      }
      const importe = parseFloat(String(amountStr).replace(/\./g, "").replace(",", "."))
      if (isNaN(importe)) {
        const err: any = new Error("Importe inválido")
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
      if (!row) continue
      const dateStr = row[0]
      const conceptStr = row[2]
      const descStr = row[3]
      const amountStr = row[4]
      const extra1 = row[5]
      const extra2 = row[6]
      if (!dateStr || !conceptStr || !amountStr) continue
      const date = parse(String(dateStr), "d/M/yyyy", new Date(), { locale: es })
      if (isNaN(date.getTime())) {
        const err: any = new Error("Fecha inválida")
        err.row = i + 1
        err.code = "INVALID_DATE"
        throw err
      }
      const importe = parseFloat(String(amountStr).replace(/\./g, "").replace(",", "."))
      if (isNaN(importe)) {
        const err: any = new Error("Importe inválido")
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
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 }) as any[][]

      const parsed = source === "sabadell" ? parseSabadell(rows) : parseCaixabank(rows)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const toInsert: any[] = []
      let duplicates = 0
      for (let i = 0; i < parsed.length; i++) {
        const trx = parsed[i]
        // [DUPLICATE_CHECK] Detect possible duplicates already stored
        const { data: existing } = await supabase
          .from("movimiento")
          .select("id")
          .eq("cuenta_id", accountId)
          .eq("concepto", trx.concepto)
          .eq("fecha", trx.fecha)
          .eq("importe", trx.importe)
          .limit(1)
        if (existing && existing.length > 0) {
          duplicates++
        } else {
          toInsert.push({
            cuenta_id: accountId,
            fecha: trx.fecha,
            concepto: trx.concepto,
            descripcion: trx.descripcion,
            importe: trx.importe,
            ignorado: false,
            creado_por: user?.id || "",
          })
        }
        setProgress(Math.round(((i + 1) / parsed.length) * 100))
      }
      setDuplicateCount(duplicates)

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from("movimiento").insert(toInsert)
        if (insertError) {
          const err: any = new Error(insertError.message)
          err.code = insertError.code
          throw err
        }
      }

      setMessage(`Se han importado ${toInsert.length} transacciones`)
      if (onImported) onImported()
    } catch (err: any) {
      setError(err.row ? `Problema con la fila ${err.row}: ${err.message}` : err.message)
      setErrorCode(err.code || "UNKNOWN")
    } finally {
      setIsImporting(false)
      setProgress(100)
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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3 pb-6 border-b">
          <SheetTitle className="text-xl">Importar transacciones</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Source Section */}
          <div className="space-y-2">
            <Label>ORIGEN DE LOS DATOS</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSource("manual")}
                className={`border rounded-md p-2 text-sm hover:bg-muted ${
                  source === "manual" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                Excel manual
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
              <p className="text-sm text-muted-foreground mt-2">
                Esta opción estará disponible próximamente
              </p>
            )}
            {(source === "sabadell" || source === "caixabank") && (
              <div className="mt-4 space-y-2">
                <Input type="file" accept=".xls,.xlsx" onChange={handleFileChange} />
                {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
              </div>
            )}
          </div>

          {/* Account Section */}
          <div className="space-y-2">
            <Label>CUENTA DE DESTINO</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
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
          <div className="pt-4">
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={!file || !accountId || !source || source === "manual" || isImporting}
            >
              Importar
            </Button>
          </div>

          {/* Status */}
          {isImporting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size="sm" />
              <span>Procesando... {progress}%</span>
            </div>
          )}
          {!isImporting && message && (
            <p className="text-sm text-green-600">{message}</p>
          )}
          {duplicateCount > 0 && (
            <p className="text-sm text-amber-600">
              {duplicateCount} posibles duplicados detectados
            </p>
          )}
          {error && (
            <div className="text-sm text-red-600 space-y-1">
              <p>{error}</p>
              {errorCode && <code className="text-xs">{errorCode}</code>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

