"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MoneyInput, formatMoney, parseMoney } from "@/components/ui/money-input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { CategoryChip } from "@/components/transactions/category-chip"
import { cn } from "@/lib/utils"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { PagoMcmArchivos } from "./pago-mcm-archivos"
import {
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
  categorias: Categoria[]
  onRequestCreateCategory?: (assign: (categoryId: string) => void | Promise<void>) => void
  onSubmit: (payload: PagoMcmFormSubmit) => Promise<PagoMcm | void>
  onCancel: () => void
}

const TIPO_CALCULO_OPTIONS: PagoMcmTipoCalculo[] = ["manual", "gasolina_tickets", "gasolina_km"]

export function PagoMcmForm({
  delegacionId,
  pago,
  contactos,
  categorias,
  onRequestCreateCategory,
  onSubmit,
  onCancel,
}: PagoMcmFormProps) {
  const isEdit = Boolean(pago?.id)

  const [contactoId, setContactoId] = useState<string | null>(pago?.contacto_id ?? null)
  const [concepto, setConcepto] = useState(pago?.concepto ?? "")
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? "")
  const [importeDisplay, setImporteDisplay] = useState(pago ? formatMoney(Number(pago.importe)) : "")
  const [tipoCalculo, setTipoCalculo] = useState<PagoMcmTipoCalculo>(pago?.tipo_calculo ?? "manual")
  const [categoriaSugeridaId, setCategoriaSugeridaId] = useState<string | null>(pago?.categoria_id_sugerida ?? null)
  const [notas, setNotas] = useState(pago?.notas ?? "")
  const [detallesOpen, setDetallesOpen] = useState(false)

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

  const [loading, setLoading] = useState<PagoMcmEstado | null>(null)

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

  const importeNumerico = tipoCalculo === "gasolina_km" ? importeCalculadoKm ?? 0 : parseMoney(importeDisplay) ?? 0

  const categoriaSugerida = categorias.find((c) => c.id === categoriaSugeridaId)

  const handleRequestCreateCategory = () => {
    onRequestCreateCategory?.((newId) => setCategoriaSugeridaId(newId))
  }

  const handleSubmit = async (targetEstado: "borrador" | "pendiente") => {
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

    setLoading(targetEstado)
    try {
      if (isEdit && pago) {
        const update: PagoMcmUpdate = {
          contacto_id: contactoId,
          concepto: conceptoTrim,
          descripcion: descripcion.trim() || null,
          importe: importeNumerico,
          estado: targetEstado,
          tipo_calculo: tipoCalculo,
          categoria_id_sugerida: categoriaSugeridaId,
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
          estado: targetEstado,
          tipo_calculo: tipoCalculo,
          categoria_id_sugerida: categoriaSugeridaId,
          notas: notas.trim() || null,
          ...gasolinaData,
        }
        await onSubmit({ insert })
      }
      toast.success(isEdit ? "Pago actualizado" : "Pago creado")
    } catch (err) {
      toast.error("No se pudo guardar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setLoading(null)
    }
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5 pb-6"
    >
      {/* A quién y por qué */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contacto *</Label>
          <ContactoSelector
            contactos={contactos}
            value={contactoId}
            onChange={setContactoId}
            placeholder="¿A quién hay que pagar?"
          />
        </div>
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
      </div>

      <Separator />

      {/* Cuánto */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Tipo de cálculo</Label>
          <div className="inline-flex w-full rounded-xl border border-border/60 bg-muted/40 p-1">
            {TIPO_CALCULO_OPTIONS.map((t) => {
              const info = PAGO_MCM_TIPO_CALCULO_INFO[t]
              const active = tipoCalculo === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoCalculo(t)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium tracking-tight transition-colors",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {info.shortLabel}
                </button>
              )
            })}
          </div>
        </div>

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
                <Checkbox id="ida-vuelta" checked={idaVuelta} onCheckedChange={(c) => setIdaVuelta(Boolean(c))} />
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
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight transition-colors tabular-nums",
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
          </div>
        )}

        {tipoCalculo === "gasolina_tickets" && (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
            Sube los tickets en justificantes e introduce el importe total a mano.
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="importe">Importe *</Label>
          {tipoCalculo === "gasolina_km" ? (
            <div className="flex items-center justify-between rounded-xl border-2 border-input bg-muted/30 px-4 py-2.5">
              <span className="text-xs text-muted-foreground tabular-nums">
                {parseFloat(km.replace(",", ".")) || 0} km{idaVuelta ? " × 2" : ""} × {precioKm} €
              </span>
              <span className="text-base font-semibold tabular-nums">{formatCurrency(importeCalculadoKm ?? 0)}</span>
            </div>
          ) : (
            <div className="relative">
              <MoneyInput id="importe" value={importeDisplay} onValueChange={setImporteDisplay} placeholder="0,00" className="pr-8" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
          )}
          {tipoCalculo === "gasolina_km" && (
            <p className="text-[11px] text-muted-foreground">Se calcula automáticamente a partir de los kilómetros.</p>
          )}
        </div>

        {isEdit && pago && delegacionId && (
          <div className="space-y-1.5">
            <Label>Justificantes</Label>
            <PagoMcmArchivos pagoId={pago.id} delegacionId={delegacionId} />
          </div>
        )}
      </div>

      <Separator />

      {/* Detalles (colapsado por defecto) */}
      <Collapsible open={detallesOpen} onOpenChange={setDetallesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Detalles
            <ChevronDown className={cn("h-4 w-4 transition-transform", detallesOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
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

          <div className="space-y-1.5">
            <Label>Categoría sugerida</Label>
            <CategoryChip
              category={categoriaSugerida}
              categories={categorias}
              onCategoryChange={setCategoriaSugeridaId}
              onCreateCategory={onRequestCreateCategory ? handleRequestCreateCategory : undefined}
            />
            <p className="text-[11px] text-muted-foreground">Se aplicará al movimiento cuando lo conviertas o lo vincules.</p>
          </div>

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
        </CollapsibleContent>
      </Collapsible>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading != null}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit("borrador")}
          disabled={loading != null}
        >
          {loading === "borrador" ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button type="button" onClick={() => handleSubmit("pendiente")} disabled={loading != null}>
          {loading === "pendiente" ? "Guardando…" : "Guardar como pendiente"}
        </Button>
      </div>
    </form>
  )
}
