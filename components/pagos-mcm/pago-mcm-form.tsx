"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { PagoMcmArchivos } from "./pago-mcm-archivos"
import {
  PAGO_MCM_ESTADO_INFO,
  PAGO_MCM_GASOLINA_PRESETS,
  PAGO_MCM_GASOLINA_PRESETS_ORDER,
  PAGO_MCM_TIPO_CALCULO_INFO,
  calcularImporteGasolinaKm,
  inferirPresetGasolina,
} from "@/lib/utils/pago-mcm"
import { formatCurrency } from "@/lib/utils/format"
import type {
  Categoria,
  ContactoConCategoriaPredeterminada,
  PagoMcm,
  PagoMcmConRelaciones,
  PagoMcmEstado,
  PagoMcmGasolinaPreset,
  PagoMcmInsert,
  PagoMcmTipoCalculo,
  PagoMcmUpdate,
} from "@/lib/types/database"

export interface PagoMcmFormSubmit {
  insert?: Omit<PagoMcmInsert, "creado_en" | "actualizado_en">
  update?: PagoMcmUpdate
}

interface PagoMcmFormProps {
  delegacionId: string | null
  pago?: PagoMcmConRelaciones | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Pick<Categoria, "id" | "nombre" | "emoji" | "color">[]
  onSubmit: (payload: PagoMcmFormSubmit) => Promise<PagoMcm | void>
  onCancel: () => void
}

const TIPO_CALCULO_OPTIONS: PagoMcmTipoCalculo[] = [
  "manual",
  "gasolina_tickets",
  "gasolina_km",
  "gasolina_avanzado",
]

export function PagoMcmForm({
  delegacionId,
  pago,
  contactos,
  categorias,
  onSubmit,
  onCancel,
}: PagoMcmFormProps) {
  const isEdit = Boolean(pago?.id)

  const [contactoId, setContactoId] = useState<string | null>(pago?.contacto_id ?? null)
  const [concepto, setConcepto] = useState(pago?.concepto ?? "")
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? "")
  const [importeStr, setImporteStr] = useState(
    pago ? Number(pago.importe).toFixed(2).replace(".", ",") : "",
  )
  const [estado, setEstado] = useState<PagoMcmEstado>(pago?.estado ?? "pendiente")
  const [tipoCalculo, setTipoCalculo] = useState<PagoMcmTipoCalculo>(pago?.tipo_calculo ?? "manual")
  const [categoriaSugeridaId, setCategoriaSugeridaId] = useState<string | "ninguna">(
    pago?.categoria_id_sugerida ?? "ninguna",
  )
  const [notas, setNotas] = useState(pago?.notas ?? "")

  // Datos gasolina por km
  const [km, setKm] = useState<string>(
    pago?.gasolina_km_un_trayecto != null ? String(pago.gasolina_km_un_trayecto) : "",
  )
  const [idaVuelta, setIdaVuelta] = useState<boolean>(pago?.gasolina_ida_vuelta ?? false)
  const [preset, setPreset] = useState<PagoMcmGasolinaPreset>(
    pago?.gasolina_preset ??
      (pago?.gasolina_precio_km != null ? inferirPresetGasolina(Number(pago.gasolina_precio_km)) : "estandar_0_26"),
  )
  const [precioKm, setPrecioKm] = useState<string>(
    pago?.gasolina_precio_km != null
      ? Number(pago.gasolina_precio_km).toFixed(4).replace(/\.?0+$/, "")
      : String(PAGO_MCM_GASOLINA_PRESETS.estandar_0_26.precio),
  )

  const [loading, setLoading] = useState(false)

  // Cuando cambia el preset, actualiza precio (excepto en personalizado)
  useEffect(() => {
    if (preset !== "personalizado") {
      setPrecioKm(String(PAGO_MCM_GASOLINA_PRESETS[preset].precio))
    }
  }, [preset])

  // Auto-cálculo de importe para gasolina_km
  const importeCalculadoKm = useMemo(() => {
    if (tipoCalculo !== "gasolina_km") return null
    const kmNum = parseFloat(km.replace(",", ".")) || 0
    const precioNum = parseFloat(precioKm.replace(",", ".")) || 0
    return calcularImporteGasolinaKm(kmNum, idaVuelta, precioNum)
  }, [tipoCalculo, km, idaVuelta, precioKm])

  // Mantener el importe en sincronía con el cálculo de km
  useEffect(() => {
    if (importeCalculadoKm == null) return
    setImporteStr(importeCalculadoKm.toFixed(2).replace(".", ","))
  }, [importeCalculadoKm])

  const importeNumerico = useMemo(() => {
    const v = parseFloat(importeStr.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(v) ? v : 0
  }, [importeStr])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delegacionId) {
      toast.error("Selecciona una delegación antes de crear el pago")
      return
    }
    if (!contactoId) {
      toast.error("El contacto es obligatorio")
      return
    }
    const conceptoTrim = concepto.trim()
    if (!conceptoTrim) {
      toast.error("El concepto es obligatorio")
      return
    }
    if (!(importeNumerico > 0)) {
      toast.error("El importe debe ser mayor que 0")
      return
    }
    if (PAGO_MCM_TIPO_CALCULO_INFO[tipoCalculo].disabled) {
      toast.error("Este tipo de cálculo aún no está disponible")
      return
    }

    const gasolinaData =
      tipoCalculo === "gasolina_km"
        ? {
            gasolina_km_un_trayecto: parseFloat(km.replace(",", ".")) || null,
            gasolina_ida_vuelta: idaVuelta,
            gasolina_precio_km: parseFloat(precioKm.replace(",", ".")) || null,
            gasolina_preset: preset,
          }
        : {
            gasolina_km_un_trayecto: null,
            gasolina_ida_vuelta: false,
            gasolina_precio_km: null,
            gasolina_preset: null,
          }

    setLoading(true)
    try {
      if (isEdit && pago) {
        const update: PagoMcmUpdate = {
          contacto_id: contactoId,
          concepto: conceptoTrim,
          descripcion: descripcion.trim() || null,
          importe: importeNumerico,
          estado,
          tipo_calculo: tipoCalculo,
          categoria_id_sugerida: categoriaSugeridaId === "ninguna" ? null : categoriaSugeridaId,
          notas: notas.trim() || null,
          ...gasolinaData,
        }
        await onSubmit({ update })
      } else {
        const insert: Omit<PagoMcmInsert, "creado_en" | "actualizado_en"> = {
          delegacion_id: delegacionId,
          contacto_id: contactoId,
          concepto: conceptoTrim,
          descripcion: descripcion.trim() || null,
          importe: importeNumerico,
          estado,
          tipo_calculo: tipoCalculo,
          categoria_id_sugerida: categoriaSugeridaId === "ninguna" ? null : categoriaSugeridaId,
          notas: notas.trim() || null,
          ...gasolinaData,
        }
        await onSubmit({ insert })
      }
      toast.success(isEdit ? "Pago actualizado" : "Pago creado")
    } catch (err) {
      toast.error("No se pudo guardar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-6">
      {/* Contacto */}
      <div className="space-y-1.5">
        <Label>Contacto *</Label>
        <ContactoSelector
          contactos={contactos}
          value={contactoId}
          onChange={setContactoId}
          placeholder="¿A quién hay que pagar?"
        />
      </div>

      {/* Concepto */}
      <div className="space-y-1.5">
        <Label htmlFor="concepto">Concepto *</Label>
        <Input
          id="concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="P.ej. Ticket Consum del campamento"
          required
        />
      </div>

      {/* Tipo de cálculo */}
      <div className="space-y-1.5">
        <Label>Tipo de cálculo</Label>
        <Select value={tipoCalculo} onValueChange={(v) => setTipoCalculo(v as PagoMcmTipoCalculo)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPO_CALCULO_OPTIONS.map((t) => {
              const info = PAGO_MCM_TIPO_CALCULO_INFO[t]
              const TipoIcon = info.icon
              return (
                <SelectItem key={t} value={t} disabled={info.disabled}>
                  <span className="inline-flex items-center gap-2">
                    <TipoIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>{info.label}</span>
                    {info.disabled && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">próximamente</span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{PAGO_MCM_TIPO_CALCULO_INFO[tipoCalculo].descripcion}</p>
      </div>

      {/* Inputs específicos de gasolina_km */}
      {tipoCalculo === "gasolina_km" && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="km" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Km (un trayecto)
              </Label>
              <Input
                id="km"
                type="text"
                inputMode="decimal"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
            </div>
            <div className="flex items-end gap-2 pb-1.5">
              <Checkbox
                id="ida-vuelta"
                checked={idaVuelta}
                onCheckedChange={(c) => setIdaVuelta(Boolean(c))}
              />
              <Label htmlFor="ida-vuelta" className="cursor-pointer text-sm">
                Ida y vuelta <span className="text-muted-foreground">(×2)</span>
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Precio por kilómetro
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PAGO_MCM_GASOLINA_PRESETS_ORDER.map((p) => {
                const info = PAGO_MCM_GASOLINA_PRESETS[p]
                const active = preset === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight transition-all tabular-nums",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/70 bg-background text-foreground/70 hover:border-foreground/30 hover:text-foreground",
                    )}
                    title={info.descripcion}
                  >
                    {info.label}
                  </button>
                )
              })}
            </div>
            {preset === "personalizado" && (
              <Input
                type="text"
                inputMode="decimal"
                value={precioKm}
                onChange={(e) => setPrecioKm(e.target.value)}
                placeholder="0,26"
                className="mt-1.5 tabular-nums"
              />
            )}
          </div>

          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Importe calculado
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tracking-tight tabular-nums">
                {formatCurrency(importeCalculadoKm ?? 0)}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {(parseFloat(km.replace(",", ".")) || 0)} km{idaVuelta ? " × 2" : ""} × {precioKm} €
              </div>
            </div>
          </div>
        </div>
      )}

      {tipoCalculo === "gasolina_tickets" && (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          Sube los tickets en la sección de archivos (al guardar el pago) e introduce el importe total a mano.
        </div>
      )}

      {/* Importe (editable salvo en gasolina_km) */}
      <div className="space-y-1.5">
        <Label htmlFor="importe">Importe *</Label>
        <div className="relative">
          <Input
            id="importe"
            type="text"
            inputMode="decimal"
            value={importeStr}
            onChange={(e) => setImporteStr(e.target.value)}
            disabled={tipoCalculo === "gasolina_km"}
            placeholder="0,00"
            className="pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            €
          </span>
        </div>
        {tipoCalculo === "gasolina_km" && (
          <p className="text-[11px] text-muted-foreground">Se calcula automáticamente a partir de los kilómetros.</p>
        )}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="descripcion">Descripción detallada</Label>
        <Textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle del gasto para transparencia (opcional)."
          rows={3}
        />
      </div>

      {/* Categoría sugerida */}
      <div className="space-y-1.5">
        <Label>Categoría sugerida</Label>
        <Select value={categoriaSugeridaId} onValueChange={setCategoriaSugeridaId}>
          <SelectTrigger>
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguna">Sin categoría</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Se aplicará al movimiento cuando lo conviertas o lo vincules.</p>
      </div>

      {/* Estado */}
      <div className="space-y-1.5">
        <Label>Estado</Label>
        <Select value={estado} onValueChange={(v) => setEstado(v as PagoMcmEstado)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["borrador", "pendiente", "pagado", "cancelado"] as const).map((s) => {
              const info = PAGO_MCM_ESTADO_INFO[s]
              const lockedPagado = s === "pagado" && !pago?.movimiento_id
              return (
                <SelectItem key={s} value={s} disabled={lockedPagado}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", info.dotClass)} aria-hidden />
                    <span>{info.label}</span>
                    {lockedPagado && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        vincula un movimiento
                      </span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas internas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas privadas para el equipo (opcional)."
          rows={2}
        />
      </div>

      {/* Adjuntos (solo en edición) */}
      {isEdit && pago && delegacionId && (
        <div className="space-y-1.5">
          <Label>Archivos adjuntos</Label>
          <PagoMcmArchivos pagoId={pago.id} delegacionId={delegacionId} />
          <p className="text-[11px] text-muted-foreground">
            Tickets, justificantes, etc. Si vinculas este pago a un movimiento, el archivo también
            quedará disponible desde el movimiento.
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear pago"}
        </Button>
      </div>
    </form>
  )
}
