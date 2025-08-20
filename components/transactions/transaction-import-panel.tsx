"use client"

import { useState } from "react"
import Image from "next/image"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/contexts/auth-context"
import { DatabaseService } from "@/lib/services/database"
import { supabase } from "@/lib/supabase/client"
import type { Cuenta } from "@/lib/types/database"
import { parseSabadell, parseCaixabank, RowParseError, type ImportedTransaction } from "@/lib/utils/bank-import"

interface TransactionImportPanelProps {
  accounts: Cuenta[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (count: number) => void
}

type Origin = "manual" | "sabadell" | "caixabank"

const ENABLE_DUPLICATE_CHECK = true // Set to false to skip duplicate detection

export function TransactionImportPanel({ accounts, open, onOpenChange, onImported }: TransactionImportPanelProps) {
  const { user } = useAuth()
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [accountId, setAccountId] = useState<string>("")
  const [error, setError] = useState<{ message: string; code: string } | null>(null)
  const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "success">("idle")
  const [duplicates, setDuplicates] = useState<ImportedTransaction[]>([])

  const handleFile = async (file: File) => {
    setError(null)
    setTransactions([])
    setDuplicates([])
    setStatus("parsing")
    try {
      const buffer = await file.arrayBuffer()
      let parsed: ImportedTransaction[] = []
      if (origin === "sabadell") parsed = parseSabadell(buffer)
      else if (origin === "caixabank") parsed = parseCaixabank(buffer)
      else parsed = []
      setTransactions(parsed)
      setFileName(file.name)
    } catch (err) {
      if (err instanceof RowParseError) {
        setError({ message: `Error en la fila ${err.row}: ${err.message}`, code: err.code })
      } else {
        setError({ message: "No se pudo procesar el archivo", code: "PARSE" })
      }
    } finally {
      setStatus("idle")
    }
  }

  const handleImport = async () => {
    if (!accountId || transactions.length === 0) return
    setStatus("uploading")
    try {
      if (ENABLE_DUPLICATE_CHECK) {
        const dups: ImportedTransaction[] = []
        for (const t of transactions) {
          const { data } = await supabase
            .from("movimiento")
            .select("id")
            .eq("cuenta_id", accountId)
            .eq("fecha", t.fecha)
            .eq("concepto", t.concepto)
            .eq("importe", t.importe)
            .limit(1)
          if (data && data.length > 0) dups.push(t)
        }
        if (dups.length) setDuplicates(dups)
      }

      const inserts = transactions.map((t) => ({
        cuenta_id: accountId,
        fecha: t.fecha,
        concepto: t.concepto,
        descripcion: t.descripcion || null,
        importe: t.importe,
        creado_por: user?.id || ""
      }))
      await DatabaseService.insertMovimientos(inserts)
      setStatus("success")
      onImported(inserts.length)
    } catch (err) {
      setError({ message: "Error al importar los datos", code: "UPLOAD" })
      setStatus("idle")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3 pb-6 border-b">
          <SheetTitle className="text-xl">Importar transacciones</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <section className="space-y-4">
            <h4 className="font-medium">Origen de los datos</h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrigin("manual")}
                className={`border rounded-md p-3 text-sm ${origin === "manual" ? "border-primary" : "border-muted"}`}
              >
                Excel manual
              </button>
              <button
                type="button"
                onClick={() => setOrigin("sabadell")}
                className={`border rounded-md p-3 flex items-center justify-center ${origin === "sabadell" ? "border-primary" : "border-muted"}`}
              >
                <Image src="/bank-logos/sabadell.png" alt="Sabadell" width={80} height={24} />
              </button>
              <button
                type="button"
                onClick={() => setOrigin("caixabank")}
                className={`border rounded-md p-3 flex items-center justify-center ${origin === "caixabank" ? "border-primary" : "border-muted"}`}
              >
                <Image src="/bank-logos/caixabank.png" alt="Caixabank" width={80} height={24} />
              </button>
            </div>
            {origin === "manual" && (
              <p className="text-sm text-muted-foreground">Funcionalidad disponible próximamente.</p>
            )}
            {(origin === "sabadell" || origin === "caixabank") && (
              <div className="mt-4">
                <label
                  htmlFor="import-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer text-sm text-muted-foreground hover:bg-muted/50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) handleFile(f)
                  }}
                >
                  {fileName ? <span className="text-center px-2">{fileName}</span> : <span>Arrastra o haz click para subir</span>}
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h4 className="font-medium">Cuenta de destino</h4>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
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
          </section>

          {error && (
            <div className="text-sm text-red-600">
              {error.message}
              <div className="text-xs mt-1">
                <code>{error.code}</code>
              </div>
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="text-sm text-amber-600">
              Se detectaron {duplicates.length} posibles duplicados
            </div>
          )}

          {status === "uploading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size="sm" /> Importando...
            </div>
          )}

          {status === "success" && (
            <div className="text-sm text-green-600">
              Se han importado {transactions.length} transacciones
            </div>
          )}

          <Button
            className="w-full"
            disabled={
              origin === "manual" || !accountId || transactions.length === 0 || status === "uploading" || status === "parsing"
            }
            onClick={handleImport}
          >
            Importar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
