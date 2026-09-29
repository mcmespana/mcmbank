"use client"

import { useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateField } from "@/components/ui/date-field"
import { MoneyInput, formatMoney, parseMoney } from "@/components/ui/money-input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
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
import { actualizarSubvencion, crearSubvencion } from "@/lib/services/subvenciones"
import { SUBVENCION_ESTADOS, SUBVENCION_ESTADO_INFO } from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import type { Subvencion, SubvencionEstado } from "@/lib/types/database"

interface SubvencionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si viene, se edita; si no, se crea. */
  subvencion?: Subvencion | null
  onSaved: (subvencion: Subvencion) => void
}

interface Borrador {
  nombre: string
  financiador: string
  convocatoria: string
  expediente: string
  ejercicio: string
  estado: SubvencionEstado
  fecha_solicitud: string | null
  importe_solicitado: string
  fecha_concesion: string | null
  importe_concedido: string
  periodo_desde: string | null
  periodo_hasta: string | null
  fecha_limite_justificacion: string | null
  notas: string
}

function borradorDe(s?: Subvencion | null): Borrador {
  return {
    nombre: s?.nombre ?? "",
    financiador: s?.financiador ?? "",
    convocatoria: s?.convocatoria ?? "",
    expediente: s?.expediente ?? "",
    ejercicio: s?.ejercicio ? String(s.ejercicio) : String(new Date().getFullYear()),
    estado: s?.estado ?? "solicitada",
    fecha_solicitud: s?.fecha_solicitud ?? null,
    importe_solicitado: formatMoney(s?.importe_solicitado),
    fecha_concesion: s?.fecha_concesion ?? null,
    importe_concedido: formatMoney(s?.importe_concedido),
    periodo_desde: s?.periodo_desde ?? null,
    periodo_hasta: s?.periodo_hasta ?? null,
    fecha_limite_justificacion: s?.fecha_limite_justificacion ?? null,
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

const texto = (v: string) => (v.trim() ? v.trim() : null)

/**
 * Alta y edición de la ficha de una subvención. Los campos son provisionales
 * (el Excel de la oficina técnica tiene más): lo imprescindible es nombre y
 * financiador, el resto se va rellenando según avanza el expediente.
 */
export function SubvencionFormDialog({ open, onOpenChange, subvencion, onSaved }: SubvencionFormDialogProps) {
  const { user } = useAuth()
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(subvencion))
  const [claveAbierta, setClaveAbierta] = useState<string | null>(null)
  const { enviando, guard } = useSubmitGuard()

  // Rehace el borrador cada vez que se abre (o cambia la subvención editada),
  // sin efecto: se compara durante el render.
  const clave = open ? (subvencion?.id ?? "nueva") : null
  if (clave !== claveAbierta) {
    setClaveAbierta(clave)
    if (clave) setBorrador(borradorDe(subvencion))
  }

  const set = <K extends keyof Borrador>(campo: K, valor: Borrador[K]) =>
    setBorrador((b) => ({ ...b, [campo]: valor }))

  const periodoInvalido =
    !!borrador.periodo_desde && !!borrador.periodo_hasta && borrador.periodo_desde > borrador.periodo_hasta
  const puedeGuardar = borrador.nombre.trim() && borrador.financiador.trim() && !periodoInvalido

  const handleSubmit = guard(async () => {
    if (!puedeGuardar) return
    const ejercicio = borrador.ejercicio.trim() ? Number.parseInt(borrador.ejercicio, 10) : null
    const datos = {
      nombre: borrador.nombre.trim(),
      financiador: borrador.financiador.trim(),
      convocatoria: texto(borrador.convocatoria),
      expediente: texto(borrador.expediente),
      ejercicio: Number.isFinite(ejercicio) ? ejercicio : null,
      estado: borrador.estado,
      fecha_solicitud: borrador.fecha_solicitud || null,
      importe_solicitado: parseMoney(borrador.importe_solicitado),
      fecha_concesion: borrador.fecha_concesion || null,
      importe_concedido: parseMoney(borrador.importe_concedido),
      periodo_desde: borrador.periodo_desde || null,
      periodo_hasta: borrador.periodo_hasta || null,
      fecha_limite_justificacion: borrador.fecha_limite_justificacion || null,
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
          <DialogDescription>
            Solo el nombre y el financiador son obligatorios. El resto se completa según avance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" id="subvencion-form">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sv-nombre">Nombre</Label>
              <Input
                id="sv-nombre"
                autoFocus
                value={borrador.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="IVAJ 2026 · Actividades juveniles"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-financiador">Financiador</Label>
              <Input
                id="sv-financiador"
                value={borrador.financiador}
                onChange={(e) => set("financiador", e.target.value)}
                placeholder="Generalitat Valenciana · IVAJ"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-estado">Estado</Label>
              <Select value={borrador.estado} onValueChange={(v) => set("estado", v as SubvencionEstado)}>
                <SelectTrigger id="sv-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {SUBVENCION_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {SUBVENCION_ESTADO_INFO[e].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-convocatoria">Convocatoria</Label>
              <Input
                id="sv-convocatoria"
                value={borrador.convocatoria}
                onChange={(e) => set("convocatoria", e.target.value)}
                placeholder="Línea, orden o resolución"
              />
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sv-expediente">Expediente</Label>
                <Input
                  id="sv-expediente"
                  value={borrador.expediente}
                  onChange={(e) => set("expediente", e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="sv-ejercicio">Ejercicio</Label>
                <Input
                  id="sv-ejercicio"
                  inputMode="numeric"
                  value={borrador.ejercicio}
                  onChange={(e) => set("ejercicio", e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
            </div>
          </div>

          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium text-foreground">Solicitud y concesión</legend>
            <div className="space-y-1.5">
              <Label htmlFor="sv-fecha-solicitud">Fecha de solicitud</Label>
              <FechaOpcional
                id="sv-fecha-solicitud"
                value={borrador.fecha_solicitud}
                onChange={(v) => set("fecha_solicitud", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-importe-solicitado">Importe solicitado</Label>
              <MoneyInput
                id="sv-importe-solicitado"
                value={borrador.importe_solicitado}
                onValueChange={(v) => set("importe_solicitado", v)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-fecha-concesion">Fecha de concesión</Label>
              <FechaOpcional
                id="sv-fecha-concesion"
                value={borrador.fecha_concesion}
                onChange={(v) => set("fecha_concesion", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-importe-concedido">Importe concedido</Label>
              <MoneyInput
                id="sv-importe-concedido"
                value={borrador.importe_concedido}
                onValueChange={(v) => set("importe_concedido", v)}
                placeholder="0,00"
              />
            </div>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium text-foreground">Justificación</legend>
            <div className="space-y-1.5">
              <Label htmlFor="sv-periodo-desde">Gastos desde</Label>
              <FechaOpcional
                id="sv-periodo-desde"
                value={borrador.periodo_desde}
                onChange={(v) => set("periodo_desde", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-periodo-hasta">Gastos hasta</Label>
              <FechaOpcional
                id="sv-periodo-hasta"
                value={borrador.periodo_hasta}
                onChange={(v) => set("periodo_hasta", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-limite">Límite para justificar</Label>
              <FechaOpcional
                id="sv-limite"
                value={borrador.fecha_limite_justificacion}
                onChange={(v) => set("fecha_limite_justificacion", v)}
              />
            </div>
            {periodoInvalido && (
              <p className="text-xs text-destructive sm:col-span-3" role="alert">
                El periodo termina antes de empezar.
              </p>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-3">
              El periodo de gastos solo sirve para avisar de los movimientos que caen fuera; no los rechaza.
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="sv-notas">Notas</Label>
            <Textarea
              id="sv-notas"
              rows={3}
              value={borrador.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </div>
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
