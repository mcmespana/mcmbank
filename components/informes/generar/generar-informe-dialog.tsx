"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InformesService } from "@/lib/services/informes"
import { CategoriaPickerDialog } from "./categoria-picker-dialog"
import { useCategorias } from "@/hooks/use-categorias"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import { formatCurrency } from "@/lib/utils/format"
import { buildPeriodoOptions, cursoLabelFromAnio, type PeriodoTipo } from "@/lib/types/informes"
import type { InformeConArchivos } from "@/lib/types/database"
import type {
  Capitulo,
  Fuente,
  MapeoConfig,
  MapeoFila,
  PreviewResultado,
  ResumenValidacion,
} from "@/lib/services/memoria-economica"
import { cn } from "@/lib/utils"
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
  Info,
  Plus,
  ChevronsUpDown,
  Wallet,
  Coins,
  Receipt,
  CalendarRange,
  HeartHandshake,
  Boxes,
  Check,
  Scale,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"

const eur = (n: number | undefined) => (typeof n === "number" ? formatCurrency(n) : "—")

// Fila fija "Donativo total realizado" del capítulo V (misma constante que en
// lib/services/memoria-economica.ts — no se importa para no meter googleapis
// en el bundle del cliente).
const FILA_DONATIVO = 39

const CAP_LABEL: Record<Capitulo, string> = {
  I: "Capítulo I · Saldos curso anterior",
  II: "Capítulo II · Ingresos por cuotas y subvenciones",
  III: "Capítulo III · Gastos de funcionamiento",
  IV: "Capítulo IV · Actividades",
  V: "Capítulo V · Campañas solidarias",
  VI: "Capítulo VI · Otros",
}
const CAP_ORDER: Capitulo[] = ["I", "II", "III", "IV", "V", "VI"]

// Diseño por capítulo: número romano, icono (lucide, no emoji) y color de acento.
const CAP_META: Record<Capitulo, { num: string; icon: LucideIcon; accent: string; chip: string }> = {
  I: { num: "I", icon: Wallet, accent: "border-l-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  II: { num: "II", icon: Coins, accent: "border-l-emerald-400", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  III: { num: "III", icon: Receipt, accent: "border-l-rose-400", chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  IV: { num: "IV", icon: CalendarRange, accent: "border-l-sky-400", chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  V: { num: "V", icon: HeartHandshake, accent: "border-l-violet-400", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  VI: { num: "VI", icon: Boxes, accent: "border-l-amber-400", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
}

type Modo = "saldo" | "ingreso" | "gasto" | "ambos"
function modoDeFila(fila: MapeoFila): Modo {
  if (fila.capitulo === "I") return "saldo"
  if (fila.capitulo === "III") return "gasto"
  if (fila.capitulo === "II") return fila.fila === 10 ? "gasto" : "ingreso"
  if (fila.capitulo === "V" && fila.fila === FILA_DONATIVO) return "gasto"
  return "ambos" // IV, V, VI
}

function categoriaIdDeFila(fila: MapeoFila): string | null {
  const f = fila.ingreso ?? fila.gasto
  if (f && f.tipo === "categoria") return f.categoriaId
  return null
}

// ---------- Stepper ----------

const STEPS = [
  { key: "config", label: "Periodo" },
  { key: "mapeo", label: "Revisar y cuadrar" },
  { key: "done", label: "¡Listo!" },
] as const

function Stepper({ step }: { step: (typeof STEPS)[number]["key"] }) {
  const idx = STEPS.findIndex((s) => s.key === step)
  return (
    <div className="flex items-center gap-1.5 pt-1">
      {STEPS.map((s, i) => {
        const done = i < idx
        const current = i === idx
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={cn("h-px w-5 sm:w-8", i <= idx ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                done || current
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
                current && "ring-2 ring-primary/25 ring-offset-1 ring-offset-background",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs",
                current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Panel de validación (cuadre del ejercicio) ----------

function ValidacionPanel({ resumen, finLabel }: { resumen: ResumenValidacion; finLabel: string }) {
  const [detalle, setDetalle] = useState(false)
  const r = resumen
  const remananteDistinto = Math.abs(r.remanenteInforme - r.remanenteReal) >= 0.005
  const hayNoRecogido = r.noRecogidoIngresos >= 0.005 || r.noRecogidoGastos >= 0.005
  const hayDoble = r.dobleContadoIngresos >= 0.005 || r.dobleContadoGastos >= 0.005

  const celdas: { label: string; value: number; className?: string; signo?: string }[] = [
    { label: "Remanente anterior", value: r.remanenteInforme },
    { label: "Entradas", value: r.informeIngresos, className: "text-emerald-600 dark:text-emerald-400", signo: "+" },
    { label: "Salidas", value: r.informeGastos, className: "text-red-500", signo: "−" },
    { label: "Terminas con", value: r.disponibleFinal, className: "font-bold" },
  ]

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border p-3",
        r.cuadra
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/15"
          : "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/15",
      )}
    >
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cuadre del ejercicio
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            r.cuadra
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
          )}
        >
          {r.cuadra ? (
            <>
              <CheckCircle2 className="h-3 w-3" /> Cuadra al céntimo
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3" /> Descuadre de {eur(Math.abs(r.descuadre))}
            </>
          )}
        </span>
      </div>

      {/* remanente + entradas − salidas = cierre */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {celdas.map((c, i) => (
          <div key={c.label} className="relative rounded-lg border bg-background/70 px-2.5 py-1.5">
            {i > 0 && (
              <span className="absolute -left-2 top-1/2 hidden -translate-y-1/2 text-xs font-bold text-muted-foreground sm:block">
                {i === 3 ? "=" : c.signo}
              </span>
            )}
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={cn("text-sm tabular-nums", c.className ?? "font-medium")}>{eur(c.value)}</p>
          </div>
        ))}
      </div>

      {r.cuadra ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          Sumando entradas y salidas e incorporando el remanente, terminas el ejercicio con{" "}
          <strong className="tabular-nums">{eur(r.disponibleFinal)}</strong> — exactamente el saldo
          real de tus cuentas al {finLabel}. 👌
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            El informe cierra con <strong className="tabular-nums">{eur(r.disponibleFinal)}</strong>,
            pero el saldo real de tus cuentas al {finLabel} es{" "}
            <strong className="tabular-nums">{eur(r.saldoFinalReal)}</strong>.
            <button
              type="button"
              onClick={() => setDetalle((d) => !d)}
              className="ml-1.5 inline-flex items-center gap-0.5 font-semibold underline underline-offset-2"
            >
              ¿Por qué? <ChevronDown className={cn("h-3 w-3 transition-transform", detalle && "rotate-180")} />
            </button>
          </p>
          {detalle && (
            <ul className="space-y-1 rounded-md bg-background/70 p-2.5 text-xs text-muted-foreground">
              {hayNoRecogido && (
                <li className="flex gap-1.5">
                  <span>•</span>
                  <span>
                    <strong>{r.noRecogidoMovs} movimientos del periodo no los recoge ninguna fila</strong>
                    {": "}
                    {r.noRecogidoIngresos >= 0.005 && (
                      <>entradas por <strong className="tabular-nums">{eur(r.noRecogidoIngresos)}</strong></>
                    )}
                    {r.noRecogidoIngresos >= 0.005 && r.noRecogidoGastos >= 0.005 && " y "}
                    {r.noRecogidoGastos >= 0.005 && (
                      <>salidas por <strong className="tabular-nums">{eur(r.noRecogidoGastos)}</strong></>
                    )}
                    . Son movimientos sin categoría o de categorías sin fila en el informe.
                  </span>
                </li>
              )}
              {hayDoble && (
                <li className="flex gap-1.5">
                  <span>•</span>
                  <span>
                    <strong>Importes contados más de una vez</strong>
                    {": "}
                    {r.dobleContadoIngresos >= 0.005 && (
                      <>entradas por <strong className="tabular-nums">{eur(r.dobleContadoIngresos)}</strong></>
                    )}
                    {r.dobleContadoIngresos >= 0.005 && r.dobleContadoGastos >= 0.005 && " y "}
                    {r.dobleContadoGastos >= 0.005 && (
                      <>salidas por <strong className="tabular-nums">{eur(r.dobleContadoGastos)}</strong></>
                    )}
                    . Suele pasar al asignar una categoría madre y una subcategoría suya en filas
                    distintas.
                  </span>
                </li>
              )}
              {remananteDistinto && (
                <li className="flex gap-1.5">
                  <span>•</span>
                  <span>
                    El remanente del informe (<span className="tabular-nums">{eur(r.remanenteInforme)}</span>)
                    no coincide con el saldo inicial real (
                    <span className="tabular-nums">{eur(r.remanenteReal)}</span>). Revisa las filas del
                    capítulo I (banco {eur(r.remanenteBanco)} · caja {eur(r.remanenteCaja)}).
                  </span>
                </li>
              )}
              {!hayNoRecogido && !hayDoble && !remananteDistinto && (
                <li>Diferencia por filas con importe manual o redondeos.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
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
  const [result, setResult] = useState<{
    driveUrl: string | null
    titulo: string
    remanente: number | null
    balanceAnual: number | null
    disponibleFinal: number | null
    resumen: ResumenValidacion | null
    cuadraConHoja: boolean
  } | null>(null)
  const [pickerFila, setPickerFila] = useState<MapeoFila | null>(null)

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

  const setCategoria = (fila: MapeoFila, categoriaId: string | null, categoriaNombre?: string) => {
    const modo = modoDeFila(fila)
    const fuente: Fuente | null = categoriaId ? { tipo: "categoria", categoriaId } : null
    // En IV/V/VI la descripción de la fila es el propio nombre de la categoría.
    const patchDesc = fila.escribirDescripcion ? { descripcion: categoriaNombre ?? "" } : {}
    if (modo === "ingreso") updateFila(fila.id, { ingreso: fuente, gasto: null, ...patchDesc })
    else if (modo === "gasto") updateFila(fila.id, { gasto: fuente, ingreso: null, ...patchDesc })
    else if (modo === "ambos") updateFila(fila.id, { ingreso: fuente, gasto: fuente, ...patchDesc })
  }

  const isCapExcluido = (cap: Capitulo) => (mapeo?.capitulosExcluidos ?? []).includes(cap)

  const toggleCapitulo = (cap: Capitulo, incluir: boolean) => {
    setMapeo((prev) => {
      if (!prev) return prev
      const set = new Set(prev.capitulosExcluidos ?? [])
      if (incluir) set.delete(cap)
      else set.add(cap)
      // Al incluir un capítulo se marcan TODAS sus filas disponibles; al excluir,
      // se desmarcan (además de borrarse su rango completo al generar).
      const filas = prev.filas.map((f) =>
        f.capitulo === cap ? { ...f, enabled: incluir } : f,
      )
      const next = { ...prev, filas, capitulosExcluidos: [...set] }
      recompute(next)
      return next
    })
  }

  /** Activa la siguiente fila libre de un capítulo (para añadir más líneas). */
  const addFilaCapitulo = (cap: Capitulo) => {
    setMapeo((prev) => {
      if (!prev) return prev
      const libre = prev.filas.find(
        (f) => f.capitulo === cap && !f.enabled && f.fila !== FILA_DONATIVO,
      )
      if (!libre) {
        toast.error("No quedan más filas disponibles en la plantilla para este capítulo")
        return prev
      }
      const next = {
        ...prev,
        filas: prev.filas.map((f) => (f.id === libre.id ? { ...f, enabled: true } : f)),
      }
      recompute(next)
      return next
    })
  }

  const filasLibres = (cap: Capitulo) =>
    (mapeo?.filas ?? []).some((f) => f.capitulo === cap && !f.enabled && f.fila !== FILA_DONATIVO)

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
      setResult({
        driveUrl: data.driveUrl ?? null,
        titulo: data.titulo,
        remanente: typeof data.remanente === "number" ? data.remanente : null,
        balanceAnual: typeof data.balanceAnual === "number" ? data.balanceAnual : null,
        disponibleFinal: typeof data.disponibleFinal === "number" ? data.disponibleFinal : null,
        resumen: (data.resumen as ResumenValidacion) ?? null,
        cuadraConHoja: !!data.cuadraConHoja,
      })
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

  const { categorias: dbCategorias } = useCategorias(delegacionId, {
    includeGlobal: true,
    includeInactive: false,
  })
  const catNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of dbCategorias) m.set(c.id, c.nombre)
    return m
  }, [dbCategorias])
  const catColorById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of dbCategorias) m.set(c.id, getCategoryColorTokens(c, dbCategorias).color)
    return m
  }, [dbCategorias])
  const periodoOptions = useMemo(() => buildPeriodoOptions(periodoTipo), [periodoTipo])

  // Conjunto de categorías ya asignadas en alguna fila (para no repetirlas).
  const categoriasUsadas = useMemo(() => {
    const s = new Set<string>()
    for (const f of mapeo?.filas ?? []) {
      const c = categoriaIdDeFila(f)
      if (c) s.add(c)
    }
    return s
  }, [mapeo])

  const saldoFecha = periodoTipo === "curso" ? "1 de septiembre" : "1 de enero"
  const finLabel =
    periodoTipo === "curso" ? `31 de agosto de ${anio + 1}` : `31 de diciembre de ${anio}`

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-4xl", step === "mapeo" && "flex h-[95vh] flex-col gap-3")}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generar memoria económica
          </DialogTitle>
          <DialogDescription>
            {step === "config" && "Elige el periodo y conecta tu cuenta de Google."}
            {step === "mapeo" &&
              "Revisa qué se escribe en cada fila y comprueba abajo que el ejercicio cuadra."}
            {step === "done" && "¡Listo! Tu memoria económica está en tu Google Drive."}
          </DialogDescription>
          <Stepper step={step} />
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
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <a href="/api/google/connect?switch=1">Cambiar cuenta</a>
                      </Button>
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/api/google/connect">Conectar Google</a>
                    </Button>
                  ))}
              </div>

              {google.connected && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Se generará un archivo de Google Sheets en la carpeta{" "}
                    <span className="font-medium text-foreground">«Mi unidad»</span> de esta cuenta
                    {google.email ? ` (${google.email})` : ""} y luego tendrás que moverlo a su sitio.
                  </span>
                </div>
              )}
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
          <div className="flex min-h-0 flex-1 flex-col gap-3 py-1">
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

            {/* Mapeo por capítulo */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {CAP_ORDER.map((cap) => {
                const filasCap = mapeo.filas.filter((f) => f.capitulo === cap)
                if (filasCap.length === 0) return null
                const opcional = cap === "V" || cap === "VI"
                const flexible = cap === "IV" || cap === "V" || cap === "VI"
                const excluido = isCapExcluido(cap)
                const meta = CAP_META[cap]
                const CapIcon = meta.icon
                return (
                  <div key={cap} className={cn("rounded-xl border border-l-4 bg-card/40", meta.accent)}>
                    {/* Cabecera del capítulo */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-bold",
                            meta.chip,
                          )}
                        >
                          {meta.num}
                        </span>
                        <CapIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{CAP_LABEL[cap].split(" · ")[1]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {recomputing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        {opcional && (
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                            <Checkbox checked={!excluido} onCheckedChange={(c) => toggleCapitulo(cap, !!c)} />
                            Incluir capítulo
                          </label>
                        )}
                      </div>
                    </div>

                    {opcional && excluido ? (
                      <p className="mx-3 mb-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        Capítulo desactivado: sus filas se ocultarán y no aparecerán en el PDF
                        exportado (filas {cap === "V" ? "33–39" : "40–43"} de la plantilla).
                      </p>
                    ) : (
                      <div className="space-y-2 border-t px-3 py-3">
                        {(flexible
                          ? filasCap.filter(
                              (f) =>
                                f.enabled ||
                                f.fila === FILA_DONATIVO ||
                                !!categoriaIdDeFila(f) ||
                                !!f.descripcion,
                            )
                          : filasCap
                        ).map((fila) => {
                          const modo = modoDeFila(fila)
                          const v = preview.valores[fila.id]
                          const catId = categoriaIdDeFila(fila)
                          const catNombre = catId ? catNameById.get(catId) : null
                          const esSaldo = modo === "saldo"
                          const cuentaTipo =
                            fila.ingreso?.tipo === "saldo_inicial" ? fila.ingreso.cuentaTipo : null
                          const saldoCero = esSaldo && (v?.ingreso ?? 0) === 0
                          // En IV/V/VI el "título" es la categoría; en II/III es fijo.
                          const usaPicker = !esSaldo
                          const tituloFila = fila.escribirDescripcion
                            ? catNombre ?? null
                            : fila.descripcion
                          return (
                            <div
                              key={fila.id}
                              className={cn(
                                "rounded-lg border bg-background p-2.5 transition-opacity",
                                !fila.enabled && "opacity-50",
                                saldoCero && cuentaTipo === "caja" && fila.enabled && "opacity-70",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={fila.enabled}
                                  onCheckedChange={(c) => updateFila(fila.id, { enabled: !!c })}
                                  aria-label="Incluir fila"
                                />
                                <div className="min-w-0 flex-1">
                                  {usaPicker ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={!fila.enabled}
                                      onClick={() => setPickerFila(fila)}
                                      className="h-9 w-full justify-between font-normal"
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        {catId && (
                                          <span
                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: catColorById.get(catId) }}
                                          />
                                        )}
                                        <span className={cn("truncate", !catNombre && "text-muted-foreground")}>
                                          {tituloFila || "Elegir categoría…"}
                                        </span>
                                      </span>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  ) : (
                                    <span className="text-sm font-medium">{fila.descripcion}</span>
                                  )}
                                </div>
                                <div className="shrink-0 space-y-0.5 text-right text-sm tabular-nums">
                                  {(modo === "ingreso" || modo === "ambos" || modo === "saldo") && (
                                    <div className="font-semibold text-emerald-600">{eur(v?.ingreso)}</div>
                                  )}
                                  {(modo === "gasto" || modo === "ambos") && (
                                    <div className="font-semibold text-red-500">{eur(v?.gasto)}</div>
                                  )}
                                </div>
                              </div>

                              {esSaldo && (
                                <p className="mt-1.5 pl-7 text-xs text-muted-foreground">
                                  Calculado automáticamente con el saldo{" "}
                                  {cuentaTipo === "caja" ? "de la caja" : "del banco"} el {saldoFecha}.
                                  {saldoCero && cuentaTipo === "caja" && (
                                    <span className="italic"> A 0: parece que no hay caja.</span>
                                  )}
                                </p>
                              )}
                              {usaPicker && !esSaldo && (
                                <p className="mt-1 pl-7 text-[11px] text-muted-foreground">
                                  Suma de la categoría
                                  {modo === "ambos" ? " (ingresos y gastos)" : modo === "gasto" ? " (gastos)" : " (ingresos)"}
                                </p>
                              )}
                            </div>
                          )
                        })}

                        {flexible && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addFilaCapitulo(cap)}
                            disabled={!filasLibres(cap)}
                            className="w-full border border-dashed text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Añadir fila
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {preview.resumen && <ValidacionPanel resumen={preview.resumen} finLabel={finLabel} />}

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

            {/* Cifras finales leídas del documento generado */}
            {(result.resumen || result.disponibleFinal !== null) && (
              <div className="w-full space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/30 px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Remanente anterior
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {eur(result.remanente ?? result.resumen?.remanenteInforme)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Balance del ejercicio
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {eur(result.balanceAnual ?? result.resumen?.balanceEjercicio)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/40 bg-primary/5 px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Terminas con
                    </p>
                    <p className="text-sm font-bold tabular-nums">
                      {eur(result.disponibleFinal ?? result.resumen?.disponibleFinal)}
                    </p>
                  </div>
                </div>
                {result.resumen &&
                  (result.resumen.cuadra ? (
                    <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Cuadra al céntimo con el saldo real de tus cuentas al cierre.
                    </p>
                  ) : (
                    <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      El saldo real al cierre es {eur(result.resumen.saldoFinalReal)} (descuadre de{" "}
                      {eur(Math.abs(result.resumen.descuadre))}) — repásalo en el Sheet.
                    </p>
                  ))}
              </div>
            )}

            {result.driveUrl && (
              <a
                href={result.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-3 font-semibold text-primary-foreground shadow-lg transition-[transform,box-shadow] duration-300 hover:scale-105 hover:shadow-xl"
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

    <CategoriaPickerDialog
      open={!!pickerFila}
      onOpenChange={(o) => {
        if (!o) setPickerFila(null)
      }}
      categories={dbCategorias}
      selectedId={pickerFila ? categoriaIdDeFila(pickerFila) : null}
      disabledIds={
        pickerFila
          ? [...categoriasUsadas].filter((id) => id !== categoriaIdDeFila(pickerFila))
          : []
      }
      onSelect={(id) => {
        if (pickerFila) setCategoria(pickerFila, id, id ? catNameById.get(id) : undefined)
      }}
      subtitle={pickerFila ? CAP_LABEL[pickerFila.capitulo] : undefined}
    />
    </>
  )
}
