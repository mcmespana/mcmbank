"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { FileSpreadsheet, Loader2 } from "lucide-react"

const DEFAULT_TEMPLATE_ID = "1GfIWcOiJEj90Y7r_6CK8qmMrcq1lPyDi5kG0sjSWDnA"

/** Extrae el ID de una hoja de un enlace de Google Sheets, o devuelve el texto tal cual. */
function parseSheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : input.trim()
}

export function PlantillaMemoriaSection() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("organizacion")
        .select("id, plantilla_memoria_sheet_id")
        .limit(1)
        .maybeSingle()
      if (!mounted) return
      if (error) {
        console.error("Error cargando organización:", error)
      } else if (data) {
        setOrgId(data.id)
        setValue(data.plantilla_memoria_sheet_id ?? "")
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const sheetId = value.trim() ? parseSheetId(value) : null
      const { error } = await (supabase as any)
        .from("organizacion")
        .update({ plantilla_memoria_sheet_id: sheetId })
        .eq("id", orgId)
      if (error) throw error
      setValue(sheetId ?? "")
      toast.success("Plantilla guardada")
    } catch (err) {
      console.error(err)
      toast.error("No se pudo guardar la plantilla")
    } finally {
      setSaving(false)
    }
  }

  const effectiveId = value.trim() ? parseSheetId(value) : DEFAULT_TEMPLATE_ID

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Plantilla memoria económica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Hoja de Google Sheets que se duplicará al generar las memorias económicas anuales. Pega el
          enlace o el ID de la hoja. Si lo dejas vacío se usa la plantilla por defecto.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Enlace o ID de la plantilla</Label>
          {loading ? (
            <div className="flex h-10 items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={DEFAULT_TEMPLATE_ID}
            />
          )}
          <p className="break-all text-xs text-muted-foreground">
            ID efectivo: <span className="font-mono">{effectiveId}</span>
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
