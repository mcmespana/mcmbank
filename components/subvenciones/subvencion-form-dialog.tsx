"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronDown, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DateField } from "@/components/ui/date-field"
import { MoneyInput, formatMoney, parseMoney } from "@/components/ui/money-input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSubmitGuard } from "@/hooks/use-submit-guard"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { FinanciadorSelector } from "./financiador-selector"
import { actualizarSubvencion, crearSubvencion } from "@/lib/services/subvenciones"
import { SUBVENCION_ESTADOS, SUBVENCION_ESTADO_INFO } from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import { cn } from "@/lib/utils"
import type { Subvencion, SubvencionEnlace, SubvencionEstado } from "@/lib/types/database"

interface SubvencionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si viene, se edita; si no, se crea. */
  subvencion?: Subvencion | null
  /** Al crear: valores de partida (p. ej. la del año pasado, para repetirla). */
  plantilla?: Partial<Subvencion> | null
  onSaved: (subvencion: Subvencion) => void
}

interface Borrador {
  codigo: string
  nombre: string
  financiador_id: string | null
  ejercicio: string
  estado: SubvencionEstado
  solicitante: string
  importe_solicitado: string
  importe_concedido: string
  importe_cobrado: string
  fecha_convocatoria: string | null
  fecha_limite_solicitud: string | null
  fecha_solicitud: string | null
  fecha_concesion: string | null
  fecha_justificacion_1: string | null
  fecha_justificacion_2: string | null
  periodo_desde: string | null
  periodo_hasta: string | null
  justificacion_completa: boolean
  recurrente: boolean
  convocatoria: string
  expediente: string
  url_carpeta: string
  enlaces: SubvencionEnlace[]
  notas: string
}

function borradorDe(s?: Partial<Subvencion> | null): Borrador {
  return {
    codigo: s?.codigo ?? "",
    nombre: s?.nombre ?? "",
    financiador_id: s?.financiador_id ?? null,
    ejercicio: s && "ejercicio" in s ? (s.ejercicio ? String(s.ejercicio) : "") : String(new Date().getFullYear()),
    estado: s?.estado ?? "por_solicitar",
    solicitante: s?.solicitante ?? "AJ",
    importe_solicitado: formatMoney(s?.importe_solicitado),
    importe_concedido: formatMoney(s?.importe_concedido),
    importe_cobrado: formatMoney(s?.importe_cobrado),
    fecha_convocatoria: s?.fecha_convocatoria ?? null,
    fecha_limite_solicitud: s?.fecha_limite_solicitud ?? null,
    fecha_solicitud: s?.fecha_solicitud ?? null,
    fecha_concesion: s?.fecha_concesion ?? null,
    fecha_justificacion_1: s?.fecha_justificacion_1 ?? null,
    fecha_justificacion_2: s?.fecha_justificacion_2 ?? null,
    periodo_desde: s?.periodo_desde ?? null,
    periodo_hasta: s?.periodo_hasta ?? null,
    justificacion_completa: s?.justificacion_completa ?? false,
    recurrente: s?.recurrente ?? false,
    convocatoria: s?.convocatoria ?? "",
    expediente: s?.expediente ?? "",
    url_carpeta: s?.url_carpeta ?? "",
    enlaces: s?.enlaces ?? [],
    notas: s?.notas ?? "",
  }
}

/**
 * `DateField` no se puede vaciar (solo avisa con fechas válidas), y aquí todas
 * las fechas son opcionales: una solicitud aún sin resolver no tiene fecha de
 * concesión.
 */
function FechaOpcional({
  id,
  value,
  onChange,
}: {
  id: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <DateField id={id} size="md" value={value} onChange={onChange} className="min-w-0 flex-1" />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 md:h-8 md:w-8"
          onClick={() => onChange(null)}
          aria-label="Quitar la fecha"
          title="Quitar la fecha"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function Campo({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

const texto = (v: string) => (v.trim() ? v.trim() : null)

/**
 * Alta y edición de la ficha de una subvención. Arriba lo que se mira a
 * diario (quién, cuánto, en qué estado, la fecha que aprieta); plegado en
 * "Más detalles" lo que en el Excel estaba agrupado con el "+": el nombre
 * oficial de la convocatoria, el expediente, las fechas secundarias y los
 * enlaces sueltos.
 */
export function SubvencionFormDialog({ open, onOpenChange, subvencion, plantilla, onSaved }: SubvencionFormDialogProps) {
  const { user } = useAuth()
  const { delegations } = useDelegationContext()
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(subvencion ?? plantilla))
  const [claveAbierta, setClaveAbierta] = useState<string | null>(null)
  const [detallesAbiertos, setDetallesAbiertos] = useState(false)
  const { enviando, guard } = useSubmitGuard()

  // Rehace el borrador cada vez que se abre (o cambia la subvención editada),
  // sin efecto: se compara durante el render.
  const clave = open ? (subvencion?.id ?? `nueva:${plantilla?.id ?? ""}`) : null
  if (clave !== claveAbierta) {
    setClaveAbierta(clave)
    if (clave) {
      const b = borradorDe(subvencion ?? plantilla)
      setBorrador(b)
      // Si lo plegado ya tiene algo, se abre: esconder datos que existen confunde.
      setDetallesAbiertos(
        Boolean(b.convocatoria || b.expediente || b.enlaces.length || b.periodo_desde || b.fecha_justificacion_2),
      )
    }
  }

  const set = <K extends keyof Borrador>(campo: K, valor: Borrador[K]) =>
    setBorrador((b) => ({ ...b, [campo]: valor }))

  const periodoInvalido =
    !!borrador.periodo_desde && !!borrador.periodo_hasta && borrador.periodo_desde > borrador.periodo_hasta
  const puedeGuardar = Boolean(borrador.nombre.trim() && borrador.financiador_id && !periodoInvalido)

  const solicitantes = ["AJ", ...delegations.map((d) => d.nombre)]
  const delegacionDe = (nombre: string) =>
    delegations.find((d) => d.nombre.toLowerCase() === nombre.trim().toLowerCase())?.id ?? null

  const handleSubmit = guard(async () => {
    if (!puedeGuardar) return
    const ejercicio = borrador.ejercicio.trim() ? Number.parseInt(borrador.ejercicio, 10) : null
    const datos = {
      codigo: texto(borrador.codigo),
      nombre: borrador.nombre.trim(),
      financiador_id: borrador.financiador_id,
      ejercicio: Number.isFinite(ejercicio) ? ejercicio : null,
      estado: borrador.estado,
      solicitante: texto(borrador.solicitante),
      delegacion_id: delegacionDe(borrador.solicitante),
      importe_solicitado: parseMoney(borrador.importe_solicitado),
      importe_concedido: parseMoney(borrador.importe_concedido),
      importe_cobrado: parseMoney(borrador.importe_cobrado),
      fecha_convocatoria: borrador.fecha_convocatoria || null,
      fecha_limite_solicitud: borrador.fecha_limite_solicitud || null,
      fecha_solicitud: borrador.fecha_solicitud || null,
      fecha_concesion: borrador.fecha_concesion || null,
      fecha_justificacion_1: borrador.fecha_justificacion_1 || null,
      fecha_justificacion_2: borrador.fecha_justificacion_2 || null,
      periodo_desde: borrador.periodo_desde || null,
      periodo_hasta: borrador.periodo_hasta || null,
      justificacion_completa: borrador.justificacion_completa,
      recurrente: borrador.recurrente,
      convocatoria: texto(borrador.convocatoria),
      expediente: texto(borrador.expediente),
      url_carpeta: texto(borrador.url_carpeta),
      enlaces: borrador.enlaces
        .map((e) => ({ nombre: e.nombre.trim(), url: e.url.trim() }))
        .filter((e) => e.url),
      notas: texto(borrador.notas),
    }
    try {
      const guardada = subvencion
        ? await actualizarSubvencion(subvencion.id, datos)
        : await crearSubvencion(datos, user?.id ?? null)
      toast.success(subvencion ? "Subvención guardada" : "Subvención creada")
      onSaved(guardada)
      onOpenChange(false)
    } catch (error) {
      toast.error(describirError(error, "No se ha podido guardar la subvención"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subvencion ? "Editar subvención" : "Nueva subvención"}</DialogTitle>
          <DialogDescription>Solo el nombre y el financiador son obligatorios.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" id="subvencion-form">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <Campo id="sv-codigo" label="Código">
              <Input
                id="sv-codigo"
                value={borrador.codigo}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="GVA VOL"
              />
            </Campo>
            <Campo id="sv-nombre" label="Nombre">
              <Input
                id="sv-nombre"
                autoFocus
                value={borrador.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Fomento del voluntariado"
              />
            </Campo>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Campo id="sv-financiador" label="Financiador">
              <FinanciadorSelector
                id="sv-financiador"
                value={borrador.financiador_id}
                onChange={(f) => set("financiador_id", f?.id ?? null)}
              />
            </Campo>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <Campo id="sv-ejercicio" label="Ejercicio">
                <Input
                  id="sv-ejercicio"
                  inputMode="numeric"
                  value={borrador.ejercicio}
                  onChange={(e) => set("ejercicio", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Para estudiar"
                />
              </Campo>
              <Campo id="sv-solicitante" label="La pide">
                <Input
                  id="sv-solicitante"
                  list="sv-solicitantes"
                  value={borrador.solicitante}
                  onChange={(e) => set("solicitante", e.target.value)}
                  placeholder="AJ"
                />
                <datalist id="sv-solicitantes">
                  {solicitantes.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Campo>
            </div>
            <Campo id="sv-estado" label="Estado" className="sm:col-span-2">
              <Select value={borrador.estado} onValueChange={(v) => set("estado", v as SubvencionEstado)}>
                <SelectTrigger id="sv-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {SUBVENCION_ESTADOS.map((e) => {
                    const info = SUBVENCION_ESTADO_INFO[e]
                    return (
                      <SelectItem key={e} value={e}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", info.dotClass)} aria-hidden />
                          {info.label}
                          <span className="text-xs text-muted-foreground">· {info.descripcion}</span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium text-foreground">Importes</legend>
            <Campo id="sv-solicitado" label="Solicitado">
              <MoneyInput
                id="sv-solicitado"
                value={borrador.importe_solicitado}
                onValueChange={(v) => set("importe_solicitado", v)}
                placeholder="0,00"
              />
            </Campo>
            <Campo id="sv-concedido" label="Concedido">
              <MoneyInput
                id="sv-concedido"
                value={borrador.importe_concedido}
                onValueChange={(v) => set("importe_concedido", v)}
                placeholder="0,00"
              />
            </Campo>
            <Campo id="sv-cobrado" label="Cobrado">
              <MoneyInput
                id="sv-cobrado"
                value={borrador.importe_cobrado}
                onValueChange={(v) => set("importe_cobrado", v)}
                placeholder="0,00"
              />
            </Campo>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium text-foreground">Fechas</legend>
            <Campo id="sv-limite-solicitud" label="Límite para solicitar">
              <FechaOpcional
                id="sv-limite-solicitud"
                value={borrador.fecha_limite_solicitud}
                onChange={(v) => set("fecha_limite_solicitud", v)}
              />
            </Campo>
            <Campo id="sv-concesion" label="Concesión">
              <FechaOpcional id="sv-concesion" value={borrador.fecha_concesion} onChange={(v) => set("fecha_concesion", v)} />
            </Campo>
            <Campo id="sv-justif-1" label="Justificación">
              <FechaOpcional
                id="sv-justif-1"
                value={borrador.fecha_justificacion_1}
                onChange={(v) => set("fecha_justificacion_1", v)}
              />
            </Campo>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={borrador.justificacion_completa}
                onCheckedChange={(c) => set("justificacion_completa", Boolean(c))}
              />
              Justificación completa
              <span className="text-xs text-muted-foreground">(todo presentado y requerido)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={borrador.recurrente} onCheckedChange={(c) => set("recurrente", Boolean(c))} />
              Sale cada año
            </label>
          </div>

          <Campo id="sv-carpeta" label="Carpeta de documentos">
            <Input
              id="sv-carpeta"
              type="url"
              value={borrador.url_carpeta}
              onChange={(e) => set("url_carpeta", e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </Campo>

          <Campo id="sv-notas" label="Notas">
            <Textarea id="sv-notas" rows={3} value={borrador.notas} onChange={(e) => set("notas", e.target.value)} />
          </Campo>

          <Collapsible open={detallesAbiertos} onOpenChange={setDetallesAbiertos}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                <ChevronDown className={cn("h-4 w-4 transition-transform", detallesAbiertos && "rotate-180")} />
                Más detalles
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <Campo id="sv-convocatoria" label="Nombre oficial de la convocatoria">
                <Textarea
                  id="sv-convocatoria"
                  rows={2}
                  value={borrador.convocatoria}
                  onChange={(e) => set("convocatoria", e.target.value)}
                />
              </Campo>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <Campo id="sv-expediente" label="Expediente">
                  <Input id="sv-expediente" value={borrador.expediente} onChange={(e) => set("expediente", e.target.value)} />
                </Campo>
                <Campo id="sv-convo" label="Sale la convocatoria">
                  <FechaOpcional id="sv-convo" value={borrador.fecha_convocatoria} onChange={(v) => set("fecha_convocatoria", v)} />
                </Campo>
                <Campo id="sv-presentada" label="Presentada el">
                  <FechaOpcional id="sv-presentada" value={borrador.fecha_solicitud} onChange={(v) => set("fecha_solicitud", v)} />
                </Campo>
                <Campo id="sv-justif-2" label="2ª justificación">
                  <FechaOpcional
                    id="sv-justif-2"
                    value={borrador.fecha_justificacion_2}
                    onChange={(v) => set("fecha_justificacion_2", v)}
                  />
                </Campo>
                <Campo id="sv-periodo-desde" label="Gastos desde">
                  <FechaOpcional id="sv-periodo-desde" value={borrador.periodo_desde} onChange={(v) => set("periodo_desde", v)} />
                </Campo>
                <Campo id="sv-periodo-hasta" label="Gastos hasta">
                  <FechaOpcional id="sv-periodo-hasta" value={borrador.periodo_hasta} onChange={(v) => set("periodo_hasta", v)} />
                </Campo>
              </div>
              {periodoInvalido && (
                <p className="text-xs text-destructive" role="alert">
                  El periodo de gastos termina antes de empezar.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                El periodo de gastos solo avisa de los movimientos que caen fuera; no los rechaza.
              </p>

              <div className="space-y-2">
                <Label>Otros enlaces</Label>
                {borrador.enlaces.map((e, i) => (
                  <div key={i} className="flex min-w-0 gap-2">
                    <Input
                      className="w-36 shrink-0"
                      value={e.nombre}
                      onChange={(ev) =>
                        set("enlaces", borrador.enlaces.map((x, j) => (j === i ? { ...x, nombre: ev.target.value } : x)))
                      }
                      placeholder="Bases, readme…"
                      aria-label={`Nombre del enlace ${i + 1}`}
                    />
                    <Input
                      className="min-w-0 flex-1"
                      type="url"
                      value={e.url}
                      onChange={(ev) =>
                        set("enlaces", borrador.enlaces.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))
                      }
                      placeholder="https://…"
                      aria-label={`Dirección del enlace ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => set("enlaces", borrador.enlaces.filter((_, j) => j !== i))}
                      aria-label={`Quitar el enlace ${e.nombre || i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set("enlaces", [...borrador.enlaces, { nombre: "", url: "" }])}
                >
                  <Plus className="h-4 w-4" />
                  Añadir enlace
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="subvencion-form" disabled={!puedeGuardar || enviando} aria-busy={enviando}>
            {enviando && <LoadingSpinner size="sm" />}
            {subvencion ? "Guardar cambios" : "Crear subvención"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
