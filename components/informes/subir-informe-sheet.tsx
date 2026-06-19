"use client"

import { useEffect, useMemo, useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PeriodoSelector, type PeriodoValue } from "./periodo-selector"
import { ArchivoIcon } from "./archivo-icon"
import { InformesService } from "@/lib/services/informes"
import {
  ESTADO_ORDER,
  ESTADOS,
  INFORME_MAX_FILE_SIZE,
  INFORME_MIME_TYPES,
  suggestTitulo,
  type InformeEstado,
} from "@/lib/types/informes"
import type { InformeConArchivos } from "@/lib/types/database"
import { FileService } from "@/lib/services/file-service"
import { Loader2, UploadCloud, X, Link2, Trash2 } from "lucide-react"

interface SubirInformeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  delegacionNombre: string
  /** Si se pasa, modo edición. */
  informe?: InformeConArchivos | null
  onSaved: () => void
}

const ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
}

export function SubirInformeSheet({
  open,
  onOpenChange,
  delegacionId,
  delegacionNombre,
  informe,
  onSaved,
}: SubirInformeSheetProps) {
  const isEdit = !!informe
  const currentYear = new Date().getFullYear()

  const [periodo, setPeriodo] = useState<PeriodoValue>({
    periodicidad: "anual",
    periodo_tipo: "curso",
    anio: currentYear,
    sub_periodo: null,
  })
  const [titulo, setTitulo] = useState("")
  const [tituloTouched, setTituloTouched] = useState(false)
  const [estado, setEstado] = useState<InformeEstado>("pendiente")
  const [notas, setNotas] = useState("")
  const [driveUrl, setDriveUrl] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Inicializar / resetear al abrir
  useEffect(() => {
    if (!open) return
    if (informe) {
      setPeriodo({
        periodicidad: informe.periodicidad as PeriodoValue["periodicidad"],
        periodo_tipo: informe.periodo_tipo as PeriodoValue["periodo_tipo"],
        anio: informe.anio,
        sub_periodo: informe.sub_periodo,
      })
      setTitulo(informe.titulo)
      setTituloTouched(true)
      setEstado(informe.estado as InformeEstado)
      setNotas(informe.notas ?? "")
    } else {
      setPeriodo({ periodicidad: "anual", periodo_tipo: "curso", anio: currentYear, sub_periodo: null })
      setTitulo("")
      setTituloTouched(false)
      setEstado("pendiente")
      setNotas("")
    }
    setDriveUrl("")
    setFiles([])
  }, [open, informe, currentYear])

  // Autocompletar título sugerido si el usuario no lo ha tocado
  const suggested = useMemo(
    () => suggestTitulo(delegacionNombre, { periodo_tipo: periodo.periodo_tipo, anio: periodo.anio }),
    [delegacionNombre, periodo.periodo_tipo, periodo.anio],
  )
  useEffect(() => {
    if (!tituloTouched) setTitulo(suggested)
  }, [suggested, tituloTouched])

  const onDrop = (accepted: File[]) => {
    const valid: File[] = []
    for (const f of accepted) {
      if (f.size > INFORME_MAX_FILE_SIZE) {
        toast.error(`"${f.name}" supera el tamaño máximo (25MB)`)
        continue
      }
      if (f.type && !INFORME_MIME_TYPES.includes(f.type)) {
        toast.error(`"${f.name}": tipo no permitido`)
        continue
      }
      valid.push(f)
    }
    setFiles((prev) => [...prev, ...valid])
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  })

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("El título es obligatorio")
      return
    }
    if (!isEdit && files.length === 0 && !driveUrl.trim()) {
      toast.error("Añade al menos un archivo o un enlace de Drive")
      return
    }
    setSaving(true)
    try {
      const payload = {
        tipo: "anual" as const,
        periodicidad: periodo.periodicidad,
        periodo_tipo: periodo.periodo_tipo,
        anio: periodo.anio,
        curso_label:
          periodo.periodo_tipo === "curso" ? `${periodo.anio}-${periodo.anio + 1}` : null,
        sub_periodo: periodo.sub_periodo,
        titulo: titulo.trim(),
        estado,
        notas: notas.trim() || null,
        origen: "subido" as const,
      }

      let informeId: string
      if (isEdit && informe) {
        await InformesService.update(informe.id, payload)
        informeId = informe.id
      } else {
        const created = await InformesService.create({ ...payload, delegacion_id: delegacionId })
        informeId = created.id
      }

      // Subir archivos
      for (const file of files) {
        await InformesService.uploadArchivo(informeId, delegacionId, file)
      }
      // Enlace Drive
      if (driveUrl.trim()) {
        await InformesService.addDriveLink(informeId, "Enlace Drive", driveUrl.trim())
      }

      toast.success(isEdit ? "Informe actualizado" : "Informe guardado")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error("Error guardando informe:", err)
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el informe")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar informe" : "Subir informe"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del informe o añade más archivos."
              : "Sube un informe existente (PDF, Word o Excel) y/o enlaza el archivo en Drive."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          <PeriodoSelector value={periodo} onChange={setPeriodo} />

          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value)
                setTituloTouched(true)
              }}
              placeholder="Título del informe"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as InformeEstado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_ORDER.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADOS[e].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Archivos existentes (modo edición) */}
          {isEdit && informe?.archivos && informe.archivos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Archivos actuales</Label>
              <div className="space-y-1.5">
                {informe.archivos.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm"
                  >
                    <ArchivoIcon nombre={a.nombre} mime={a.mime_type} isDrive={!!a.drive_url} />
                    <span className="flex-1 truncate">{a.nombre}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        try {
                          await InformesService.removeArchivo(a)
                          toast.success("Archivo eliminado")
                          onSaved()
                        } catch (err) {
                          console.error(err)
                          toast.error("No se pudo eliminar el archivo")
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isEdit ? "Añadir archivos" : "Archivos"}</Label>
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Arrastra archivos o haz click</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, Word (.docx) o Excel (.xlsx) · máx 25MB</p>
            </div>
            {files.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm"
                  >
                    <ArchivoIcon nombre={f.name} mime={f.type} />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{FileService.formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enlace Drive */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" /> Enlace de Google Drive (opcional)
            </Label>
            <Input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              type="url"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones internas…"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Guardar informe"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
