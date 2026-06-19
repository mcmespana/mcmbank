"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InformesService } from "@/lib/services/informes"
import { buildPeriodoOptions, cursoLabelFromAnio, type PeriodoTipo } from "@/lib/types/informes"
import type { InformeConArchivos } from "@/lib/types/database"
import type {
  Capitulo,
  CategoriaCatalogo,
  Fuente,
  MapeoConfig,
  MapeoFila,
  PreviewResultado,
} from "@/lib/services/memoria-economica"
import {
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderInput,
  Eye,
  Download,
  Save,
} from "lucide-react"

const eur = (n: number | undefined) =>
  typeof n === "number" ? n.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "—"

const CAP_LABEL: Record<Capitulo, string> = {
  I: "Capítulo I · Saldos curso anterior",
  II: "Capítulo II · Ingresos por cuotas y subvenciones",
  III: "Capítulo III · Gastos de funcionamiento",
  IV: "Capítulo IV · Actividades",
  V: "Capítulo V · Campañas solidarias",
  VI: "Capítulo VI · Otros",
}
const CAP_ORDER: Capitulo[] = ["I", "II", "III", "IV", "V", "VI"]

type Modo = "saldo" | "ingreso" | "gasto" | "ambos"
function modoDeFila(fila: MapeoFila): Modo {
  if (fila.capitulo === "I") return "saldo"
  if (fila.capitulo === "III") return "gasto"
  if (fila.capitulo === "II") return fila.fila === 10 ? "gasto" : "ingreso"
  return "ambos" // IV, V, VI
}

function categoriaIdDeFila(fila: MapeoFila): string | null {
  const f = fila.ingreso ?? fila.gasto
  if (f && f.tipo === "categoria") return f.categoriaId
  return null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  delegacionNombre: string
  /** Si es un borrador generado, se reanuda. */
  initialInforme?: InformeConArchivos | null
  onSaved: () => void
}

export function GenerarInformeDialog({
  open,
  onOpenChange,
  delegacionId,
  delegacionNombre,
  initialInforme,
  onSaved,
}: Props) {
  const currentYear = new Date().getFullYear()
  const [step, setStep] = useState<"config" | "mapeo" | "done">("config")
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("curso")
  const [anio, setAnio] = useState(currentYear)

  const [google, setGoogle] = useState<{ connected: boolean; email: string | null; loading: boolean }>({
    connected: false,
    email: null,
    loading: true,
  })

  const [preview, setPreview] = useState<PreviewResultado | null>(null)
  const [mapeo, setMapeo] = useState<MapeoConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [result, setResult] = useState<{ driveUrl: string | null; titulo: string } | null>(null)

  const informeId = initialInforme?.id ?? null

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    setStep("config")
    setResult(null)
    if (initialInforme) {
      setPeriodoTipo(initialInforme.periodo_tipo as PeriodoTipo)
      setAnio(initialInforme.anio)
      setMapeo((initialInforme.config_generacion as unknown as MapeoConfig) ?? null)
    } else {
      setPeriodoTipo("curso")
      setAnio(currentYear)
      setMapeo(null)
    }
    setPreview(null)
    // estado Google
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setGoogle({ connected: !!d.connected, email: d.email ?? null, loading: false }))
      .catch(() => setGoogle({ connected: false, email: null, loading: false }))
  }, [open, initialInforme, currentYear])

  const fetchPreview = useCallback(
    async (mapeoEnviar: MapeoConfig | null, opts: { recompute?: boolean } = {}) => {
      if (opts.recompute) setRecomputing(true)
      else setLoading(true)
      try {
        const res = await fetch("/api/informes/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delegacionId, periodoTipo, anio, mapeo: mapeoEnviar }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Error en la vista previa")
        setPreview(data as PreviewResultado)
        if (!opts.recompute) setMapeo(data.mapeo)
        return data as PreviewResultado
      } catch (err) {
        console.error(err)
        toast.error(err instanceof Error ? err.message : "Error calculando la vista previa")
        return null
      } finally {
        setLoading(false)
        setRecomputing(false)
      }
    },
    [delegacionId, periodoTipo, anio],
  )

  const handleContinue = async () => {
    const data = await fetchPreview(mapeo)
    if (data) setStep("mapeo")
  }

  // Recalcular valores (debounced) cuando cambia el mapeo en el paso de mapeo
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recompute = useCallback(
    (nextMapeo: MapeoConfig) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchPreview(nextMapeo, { recompute: true })
      }, 600)
    },
    [fetchPreview],
  )

  const updateFila = (id: string, patch: Partial<MapeoFila>) => {
    setMapeo((prev) => {
      if (!prev) return prev
      const next = { ...prev, filas: prev.filas.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
      recompute(next)
      return next
    })
  }

  const setCategoria = (fila: MapeoFila, categoriaId: string | null) => {
    const modo = modoDeFila(fila)
    const fuente: Fuente | null = categoriaId ? { tipo: "categoria", categoriaId } : null
    if (modo === "ingreso") updateFila(fila.id, { ingreso: fuente, gasto: null })
    else if (modo === "gasto") updateFila(fila.id, { gasto: fuente, ingreso: null })
    else if (modo === "ambos") updateFila(fila.id, { ingreso: fuente, gasto: fuente })
  }

  const handleGenerar = async () => {
    if (!google.connected) {
      toast.error("Conecta tu cuenta de Google primero")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/informes/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegacionId, periodoTipo, anio, mapeo, informeId }),
      })
      const data = await res.json()
      if (res.status === 428 || data?.needsAuth) {
        setGoogle((g) => ({ ...g, connected: false }))
        toast.error("Conecta tu cuenta de Google primero")
        return
      }
      if (!res.ok) throw new Error(data?.error || "Error generando la memoria")
      setResult({ driveUrl: data.driveUrl ?? null, titulo: data.titulo })
      setStep("done")
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Error generando la memoria")
    } finally {
      setGenerating(false)
    }
  }

  const handleGuardarBorrador = async () => {
    if (!mapeo) return
    setSavingDraft(true)
    try {
      const corto = delegacionNombre.replace(/^MCM\s+/i, "").trim()
      const label = periodoTipo === "curso" ? cursoLabelFromAnio(anio) : String(anio)
      const payload = {
        tipo: "anual" as const,
        periodicidad: "anual" as const,
        periodo_tipo: periodoTipo,
        anio,
        curso_label: periodoTipo === "curso" ? cursoLabelFromAnio(anio) : null,
        titulo: `MCM ${corto} · Balance Económico ${label}`,
        estado: "en_desarrollo" as const,
        origen: "generado" as const,
        config_generacion: mapeo as any,
        es_borrador: true,
      }
      if (informeId) {
        await InformesService.update(informeId, payload)
      } else {
        await InformesService.create({ ...payload, delegacion_id: delegacionId })
      }
      toast.success("Borrador guardado")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error("No se pudo guardar el borrador")
    } finally {
      setSavingDraft(false)
    }
  }

  const periodoOptions = useMemo(() => buildPeriodoOptions(periodoTipo), [periodoTipo])
  const categorias: CategoriaCatalogo[] = preview?.categorias ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generar memoria económica
          </DialogTitle>
          <DialogDescription>
            {step === "config" && "Elige el periodo y conecta tu cuenta de Google."}
            {step === "mapeo" && "Revisa qué se escribe en cada celda. Puedes editar, vaciar o quitar filas."}
            {step === "done" && "¡Listo! Tu memoria económica está en tu Google Drive."}
          </DialogDescription>
        </DialogHeader>

        {/* PASO 1 — CONFIG */}
        {step === "config" && (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de periodo</Label>
                <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curso">Curso académico</SelectItem>
                    <SelectItem value="natural">Año natural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{periodoTipo === "curso" ? "Curso" : "Año"}</Label>
                <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodoOptions.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conexión Google */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google Drive</p>
                    {google.loading ? (
                      <p className="text-xs text-muted-foreground">Comprobando…</p>
                    ) : google.connected ? (
                      <p className="text-xs text-emerald-600">
                        Conectado{google.email ? ` · ${google.email}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Conecta tu cuenta interna para guardar el archivo en tu unidad.
                      </p>
                    )}
                  </div>
                </div>
                {!google.loading &&
                  (google.connected ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/api/google/connect">Conectar Google</a>
                    </Button>
                  ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleContinue} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* PASO 2 — MAPEO */}
        {step === "mapeo" && mapeo && preview && (
          <div className="space-y-4 py-2">
            {/* Título previsto */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Título del archivo: </span>
              <span className="font-medium">{preview.textos.titulo}</span>
            </div>

            {/* Avisos */}
            {preview.avisos.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                {preview.avisos.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{a.mensaje}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tabla de mapeo por capítulo */}
            <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
              {CAP_ORDER.map((cap) => {
                const filasCap = mapeo.filas.filter((f) => f.capitulo === cap)
                if (filasCap.length === 0) return null
                return (
                  <div key={cap}>
                    <div className="sticky top-0 z-10 mb-1.5 flex items-center gap-2 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CAP_LABEL[cap]}
                      {recomputing && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    <div className="space-y-1">
                      {filasCap.map((fila) => {
                        const modo = modoDeFila(fila)
                        const v = preview.valores[fila.id]
                        const catId = categoriaIdDeFila(fila)
                        return (
                          <div
                            key={fila.id}
                            className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                              fila.enabled ? "" : "opacity-40"
                            }`}
                          >
                            <Checkbox
                              checked={fila.enabled}
                              onCheckedChange={(c) => updateFila(fila.id, { enabled: !!c })}
                              aria-label="Incluir fila"
                            />

                            <div className="min-w-0 space-y-1">
                              {fila.escribirDescripcion ? (
                                <Input
                                  value={fila.descripcion}
                                  onChange={(e) => updateFila(fila.id, { descripcion: e.target.value })}
                                  placeholder="Descripción…"
                                  className="h-7 text-xs"
                                  disabled={!fila.enabled}
                                />
                              ) : (
                                <span className="truncate text-xs font-medium">{fila.descripcion}</span>
                              )}

                              {modo === "saldo" ? (
                                <div className="text-[11px] text-muted-foreground">
                                  Saldo inicial ({fila.ingreso?.tipo === "saldo_inicial" ? fila.ingreso.cuentaTipo : "—"})
                                </div>
                              ) : (
                                <Select
                                  value={catId ?? "__none__"}
                                  onValueChange={(val) =>
                                    setCategoria(fila, val === "__none__" ? null : val)
                                  }
                                  disabled={!fila.enabled}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Categoría…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Ninguna —</SelectItem>
                                    {categorias.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.esHija ? "↳ " : ""}
                                        {c.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            <div className="text-right text-xs tabular-nums">
                              {(modo === "ingreso" || modo === "ambos" || modo === "saldo") && (
                                <div className="text-emerald-600">{eur(v?.ingreso)}</div>
                              )}
                              {(modo === "gasto" || modo === "ambos") && (
                                <div className="text-red-500">{eur(v?.gasto)}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <Button variant="ghost" onClick={() => setStep("config")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGuardarBorrador} disabled={savingDraft}>
                  {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar borrador
                </Button>
                <Button onClick={handleGenerar} disabled={generating || !google.connected}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generar
                </Button>
              </div>
            </div>
            {!google.connected && (
              <p className="text-right text-xs text-amber-600">
                Necesitas conectar Google (vuelve al paso anterior).
              </p>
            )}
          </div>
        )}

        {/* PASO 3 — ÉXITO */}
        {step === "done" && result && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
              <div className="relative rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-4 shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold">¡Memoria generada! ✨</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se ha guardado en <strong>Mi unidad</strong> de tu Google Drive.
              </p>
            </div>

            {result.driveUrl && (
              <a
                href={result.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-3 font-semibold text-primary-foreground shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                <FileSpreadsheet className="h-5 w-5" />
                Abrir en Google Sheets
                <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}

            <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-4 text-left text-sm">
              <p className="font-semibold">No olvides:</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <FolderInput className="h-4 w-4 text-primary" /> Mover el archivo a su carpeta correspondiente.
                </li>
                <li className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> Revisar los importes y ajustar lo que necesites.
                </li>
                <li className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" /> Exportarlo a PDF.
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Subirlo aquí para dejarlo archivado.
                </li>
              </ul>
            </div>

            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
