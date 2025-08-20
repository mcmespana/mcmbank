"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase/client"
import type { Cuenta } from "@/lib/types/database"

// Toggle duplicate check easily
const ENABLE_DUPLICATE_CHECK = true

type Origin = "manual" | "sabadell" | "caixabank"

interface TransactionImportPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Cuenta[]
  delegacionId?: string | null
  onImported?: () => void
}

interface ParsedRow {
  fecha: string
  concepto: string
  descripcion: string
  importe: number
}

function formatConcept(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      return word.length <= 2 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/\./g, "").replace(",", "."))
    if (isNaN(num)) throw new Error("Importe inválido")
    return num
  }
  throw new Error("Importe inválido")
}

function parseDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]
  }
  if (typeof value === "number") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-unresolved
    const XLSX = require("xlsx")
    const parsed = XLSX.SSF.parse_date_code(value)
    const d = new Date(parsed.y, parsed.m - 1, parsed.d)
    return d.toISOString().split("T")[0]
  }
  if (typeof value === "string") {
    const [d, m, y] = value.split(/[/-]/)
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  throw new Error("Fecha inválida")
}

export function TransactionImportPanel({
  open,
  onOpenChange,
  accounts,
  delegacionId,
  onImported,
}: TransactionImportPanelProps) {
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [accountId, setAccountId] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [imported, setImported] = useState<number | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const reset = useCallback(() => {
    setOrigin(null)
    setAccountId("")
    setFile(null)
    setImported(null)
    setDuplicateCount(0)
    setError(null)
    setErrorCode(null)
  }, [])

  const handleClose = (o: boolean) => {
    if (!o) {
      reset()
    }
    onOpenChange(o)
  }

  const handleImport = async () => {
    if (origin === "manual") {
      return
    }
    if (!file || !accountId || !origin) {
      setError("Selecciona origen, cuenta y archivo")
      return
    }
    setIsImporting(true)
    setImported(null)
    setError(null)
    setDuplicateCount(0)
    try {
      const arrayBuffer = await file.arrayBuffer()
      // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-unresolved
      const XLSX = require("xlsx")
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]
      let parsed: ParsedRow[] = []
      if (origin === "sabadell") {
        for (let i = 8; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length < 4) continue
          try {
            const fecha = parseDate(row[0])
            const concepto = formatConcept(String(row[1] || ""))
            const importe = parseAmount(row[3])
            parsed.push({ fecha, concepto, descripcion: "", importe })
          } catch (err) {
            throw new Error(`Fila ${i + 1}: ${(err as Error).message}`)
          }
        }
      }
      if (origin === "caixabank") {
        for (let i = 3; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length < 5) continue
          try {
            const fecha = parseDate(row[0])
            const concepto = formatConcept(String(row[2] || ""))
            const descripcionBase = String(row[3] || "")
            const extraTexts = [row[5], row[6]].filter(
              (t) => typeof t === "string" && !/^\d+$/.test(t.trim()),
            ) as string[]
            const descripcion = [descripcionBase, ...extraTexts].filter(Boolean).join("\n")
            const importe = parseAmount(row[4])
            parsed.push({ fecha, concepto, descripcion, importe })
          } catch (err) {
            throw new Error(`Fila ${i + 1}: ${(err as Error).message}`)
          }
        }
      }

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id || ""

      let toInsert = parsed.map((p) => ({
        cuenta_id: accountId,
        fecha: p.fecha,
        concepto: p.concepto,
        descripcion: p.descripcion,
        importe: p.importe,
        creado_por: userId,
      }))

      if (ENABLE_DUPLICATE_CHECK) {
        const nonDup: typeof toInsert = []
        let dup = 0
        for (const t of toInsert) {
          const { data: existing } = await supabase
            .from("movimiento")
            .select("id")
            .eq("cuenta_id", t.cuenta_id)
            .eq("fecha", t.fecha)
            .eq("importe", t.importe)
            .eq("concepto", t.concepto)
            .limit(1)
          if (existing && existing.length > 0) {
            dup++
          } else {
            nonDup.push(t)
          }
        }
        toInsert = nonDup
        setDuplicateCount(dup)
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from("movimiento").insert(toInsert)
        if (insertError) throw insertError
      }

      setImported(toInsert.length)
      if (onImported) onImported()
    } catch (err) {
      const code = Math.random().toString(36).slice(2, 8)
      setErrorCode(code)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3 pb-6 border-b">
          <SheetTitle>Importar Transacciones</SheetTitle>
        </SheetHeader>
        <div className="space-y-8 mt-6">
          {/* Origin selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Origen de los datos</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: "manual", label: "Excel manual" },
                { id: "sabadell", label: "Excel Sabadell", logo: "/bank-logos/sabadell.png" },
                { id: "caixabank", label: "Excel Caixabank", logo: "/bank-logos/caixabank.png" },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrigin(o.id as Origin)}
                  className={`border rounded p-4 text-center hover:bg-muted transition ${
                    origin === o.id ? "ring-2 ring-primary" : ""
                  }`}
                  type="button"
                >
                  {o.logo && (
                    <div className="relative h-8 w-full mb-2">
                      <Image src={o.logo} alt={o.label} fill className="object-contain" />
                    </div>
                  )}
                  <span className="text-sm font-medium">{o.label}</span>
                </button>
              ))}
            </div>
            {origin === "manual" && (
              <p className="text-sm text-muted-foreground">Opción en construcción.</p>
            )}
            {(origin === "sabadell" || origin === "caixabank") && (
              <div
                className="border-2 border-dashed rounded p-4 text-center cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) setFile(f)
                }}
              >
                <Input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                />
                {file && <p className="mt-2 text-sm">{file.name}</p>}
              </div>
            )}
          </div>

          {/* Account selection */}
          <div className="space-y-2">
            <Label htmlFor="account">Cuenta de destino</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Selecciona cuenta" />
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

          {error && (
            <div className="text-sm text-red-600">
              {error}
              {errorCode && (
                <code className="block text-xs mt-1 bg-muted p-1 rounded">{errorCode}</code>
              )}
            </div>
          )}

          {isImporting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner className="h-4 w-4" />
              Procesando...
            </div>
          )}
          {imported !== null && !isImporting && (
            <div className="text-sm text-green-600">
              Se han importado {imported} transacciones
              {duplicateCount > 0 && (
                <p className="text-amber-600 mt-1">{duplicateCount} posibles duplicados</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={origin === "manual"}>
              Importar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

