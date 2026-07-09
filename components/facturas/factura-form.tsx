"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DateField } from "@/components/ui/date-field"
import { cn } from "@/lib/utils"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { ContactoForm, type ContactoFormSubmitPayload } from "@/components/contactos/contacto-form"
import { FacturaArchivos } from "./factura-archivos"
import { FACTURA_ESTADO_INFO, FACTURA_ESTADO_ORDER } from "@/lib/utils/facturas"
import type {
  Categoria,
  Contacto,
  ContactoConCategoriaPredeterminada,
  Factura,
  FacturaConRelaciones,
  FacturaEstado,
  FacturaInsert,
  FacturaUpdate,
} from "@/lib/types/database"

export interface FacturaFormSubmit {
  insert?: Omit<FacturaInsert, "creado_en" | "actualizado_en">
  update?: FacturaUpdate
}

interface FacturaFormProps {
  delegacionId: string | null
  factura?: FacturaConRelaciones | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Pick<Categoria, "id" | "nombre" | "emoji" | "color">[]
  canManageGlobalContact?: boolean
  onCreateContacto?: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onSubmit: (payload: FacturaFormSubmit) => Promise<Factura | void>
  onCancel: () => void
}

export function FacturaForm({
  delegacionId,
  factura,
  contactos,
  categorias,
  canManageGlobalContact,
  onCreateContacto,
  onSubmit,
  onCancel,
}: FacturaFormProps) {
  const isEdit = Boolean(factura?.id)

  const [contactoId, setContactoId] = useState<string | null>(factura?.contacto_id ?? null)
  const [concepto, setConcepto] = useState(factura?.concepto ?? "")
  const [numero, setNumero] = useState(factura?.numero ?? "")
  const [fechaEmision, setFechaEmision] = useState<string | null>(factura?.fecha_emision ?? null)
  const [importeStr, setImporteStr] = useState(
    factura?.importe != null ? Number(factura.importe).toFixed(2).replace(".", ",") : "",
  )
  const [estado, setEstado] = useState<FacturaEstado>(factura?.estado ?? "bandeja")
  const [notas, setNotas] = useState(factura?.notas ?? "")
  const [loading, setLoading] = useState(false)

  const [contactoCreateOpen, setContactoCreateOpen] = useState(false)
  const [contactoInitialNombre, setContactoInitialNombre] = useState("")

  const importeNumerico = useMemo(() => {
    const trimmed = importeStr.trim()
    if (!trimmed) return null
    const v = parseFloat(trimmed.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(v) && v > 0 ? v : null
  }, [importeStr])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delegacionId) {
      toast.error("Selecciona una delegación antes de guardar la factura")
      return
    }
    if (importeStr.trim() && importeNumerico == null) {
      toast.error("El importe no es válido")
      return
    }

    const base = {
      contacto_id: contactoId,
      concepto: concepto.trim() || null,
      numero: numero.trim() || null,
      fecha_emision: fechaEmision,
      importe: importeNumerico,
      estado,
      notas: notas.trim() || null,
    }

    setLoading(true)
    try {
      if (isEdit && factura) {
        await onSubmit({ update: base })
      } else {
        await onSubmit({ insert: { ...base, delegacion_id: delegacionId } })
      }
      toast.success(isEdit ? "Factura actualizada" : "Factura creada")
    } catch (err) {
      toast.error("No se pudo guardar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 pb-6">
        {/* Proveedor */}
        <div className="space-y-1.5">
          <Label>Proveedor</Label>
          <ContactoSelector
            contactos={contactos}
            value={contactoId}
            onChange={setContactoId}
            onCreateNew={
              onCreateContacto
                ? (initialNombre) => {
                    setContactoInitialNombre(initialNombre)
                    setContactoCreateOpen(true)
                  }
                : undefined
            }
            placeholder="¿Quién emite la factura?"
          />
          <p className="text-[11px] text-muted-foreground">
            Si no existe, escríbelo y créalo al vuelo sin salir de aquí.
          </p>
        </div>

        {/* Concepto */}
        <div className="space-y-1.5">
          <Label htmlFor="factura-concepto">Concepto</Label>
          <Input
            id="factura-concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="P.ej. Material del campamento de verano"
          />
        </div>

        {/* Importe + fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="factura-importe">Importe</Label>
            <div className="relative">
              <Input
                id="factura-importe"
                type="text"
                inputMode="decimal"
                value={importeStr}
                onChange={(e) => setImporteStr(e.target.value)}
                placeholder="0,00"
                className="pr-8 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="factura-fecha">Fecha de emisión</Label>
            <DateField id="factura-fecha" value={fechaEmision} onChange={setFechaEmision} />
          </div>
        </div>

        {/* Número de factura */}
        <div className="space-y-1.5">
          <Label htmlFor="factura-numero">
            Nº de factura <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="factura-numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="P.ej. 2026-0042"
          />
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as FacturaEstado)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FACTURA_ESTADO_ORDER.map((s) => {
                const info = FACTURA_ESTADO_INFO[s]
                const lockedPagada = s === "pagada" && !factura?.movimiento_id
                return (
                  <SelectItem key={s} value={s} disabled={lockedPagada}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", info.dotClass)} aria-hidden />
                      <span>{info.label}</span>
                      {lockedPagada && (
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
          <p className="text-[11px] text-muted-foreground">{FACTURA_ESTADO_INFO[estado].descripcion}</p>
        </div>

        {/* Notas */}
        <div className="space-y-1.5">
          <Label htmlFor="factura-notas">Notas internas</Label>
          <Textarea
            id="factura-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas privadas para el equipo (opcional)."
            rows={2}
          />
        </div>

        {/* Adjuntos (solo en edición: al crear desde la bandeja el archivo ya viene) */}
        {isEdit && factura && delegacionId && (
          <div className="space-y-1.5">
            <Label>Archivos de la factura</Label>
            <FacturaArchivos facturaId={factura.id} delegacionId={delegacionId} />
            <p className="text-[11px] text-muted-foreground">
              Al vincular la factura a un movimiento, el archivo también quedará disponible desde el
              movimiento.
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear factura"}
          </Button>
        </div>
      </form>

      {/* Creación rápida de contacto sin salir del formulario */}
      {onCreateContacto && (
        <Sheet open={contactoCreateOpen} onOpenChange={setContactoCreateOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto z-[70]">
            <SheetHeader className="mb-2">
              <SheetTitle>Nuevo contacto</SheetTitle>
            </SheetHeader>
            <ContactoForm
              delegacionId={delegacionId}
              contacto={null}
              categorias={categorias}
              canManageGlobal={Boolean(canManageGlobalContact)}
              defaultTipo="proveedor"
              defaultNombre={contactoInitialNombre}
              onSubmit={async (payload) => {
                const created = (await onCreateContacto(payload)) as Contacto | void
                if (created?.id) {
                  setContactoId(created.id)
                }
                return created
              }}
              onCancel={() => setContactoCreateOpen(false)}
              onSaved={() => setContactoCreateOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
