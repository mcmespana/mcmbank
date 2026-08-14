"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, ExternalLink, Loader2, Trash2, Unlink } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ActionMenu } from "@/components/ui/action-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { AmountDisplay } from "@/components/amount-display"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { Separator } from "@/components/ui/separator"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { useAuth } from "@/contexts/auth-context"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { FACTURA_ESTADO_INFO } from "@/lib/utils/facturas"
import { formatMoney, parseMoney } from "@/components/ui/money-input"
import { FacturaDatosFields, type FacturaDatosFieldsValue } from "./factura-datos-fields"
import { FacturaConciliacionPanel } from "./factura-conciliacion-panel"
import { FacturaArchivos } from "./factura-archivos"
import { FacturaIaPanel } from "./factura-ia-panel"
import { ContactoForm, type ContactoFormSubmitPayload } from "@/components/contactos/contacto-form"
import type {
  Categoria,
  Contacto,
  ContactoConCategoriaPredeterminada,
  Factura,
  FacturaConRelaciones,
  FacturaInsert,
  FacturaUpdate,
} from "@/lib/types/database"

export interface FacturaDetailSheetSubmit {
  insert?: Omit<FacturaInsert, "creado_en" | "actualizado_en">
  update?: FacturaUpdate
}

interface FacturaDetailSheetProps {
  factura: FacturaConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Categoria[]
  canEdit: boolean
  canManageGlobalContact?: boolean
  onCreateContacto?: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onSave: (payload: FacturaDetailSheetSubmit) => Promise<Factura | void>
  onLinkMovimiento: (facturaId: string, movimientoId: string, creadoPor?: string) => Promise<void>
  onUnlinkMovimiento: (facturaId: string, movimientoId: string) => Promise<void>
  onMarcarPagadaFuera: (facturaId: string) => Promise<void>
  onDelete: (factura: FacturaConRelaciones) => void
  /** Recarga la lista tras una lectura con IA (que escribe en la factura). */
  onRefrescar?: () => void | Promise<void>
}

const EMPTY_VALUE: FacturaDatosFieldsValue = {
  contactoId: null,
  categoriaId: null,
  concepto: "",
  numero: "",
  fechaEmision: null,
  importeDisplay: "",
  notas: "",
}

/**
 * Panel único que unifica lo que hoy son tres superficies (factura-form,
 * vincular-movimiento-dialog y las acciones de la tarjeta): documento +
 * datos + candidatos de conciliación, que se recalculan al editar el
 * importe sin cerrar nada. Estructura tomada de contacto-detail-sheet.tsx.
 */
export function FacturaDetailSheet({
  factura,
  open,
  onOpenChange,
  delegacionId,
  contactos,
  categorias,
  canEdit,
  canManageGlobalContact,
  onCreateContacto,
  onSave,
  onLinkMovimiento,
  onUnlinkMovimiento,
  onMarcarPagadaFuera,
  onDelete,
  onRefrescar,
}: FacturaDetailSheetProps) {
  const { user } = useAuth()
  const isEdit = Boolean(factura?.id)

  const [value, setValue] = useState<FacturaDatosFieldsValue>(EMPTY_VALUE)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [contactoCreateOpen, setContactoCreateOpen] = useState(false)
  const [contactoInitialNombre, setContactoInitialNombre] = useState("")

  // Sincroniza el formulario cada vez que se abre para una factura distinta
  // (o para crear una nueva).
  useEffect(() => {
    if (!open) return
    setValue(
      factura
        ? {
            contactoId: factura.contacto_id,
            categoriaId: factura.categoria_id,
            concepto: factura.concepto ?? "",
            numero: factura.numero ?? "",
            fechaEmision: factura.fecha_emision,
            importeDisplay: factura.importe != null ? formatMoney(Number(factura.importe)) : "",
            notas: factura.notas ?? "",
          }
        : EMPTY_VALUE,
    )
    setSeleccion(null)
    // `actualizado_en` entra en las dependencias a propósito: cuando la lectura
    // con IA rellena campos, la factura vuelve con datos nuevos y el formulario
    // abierto tiene que reflejarlos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, factura?.id, factura?.actualizado_en])

  const importeNumerico = useMemo(() => parseMoney(value.importeDisplay), [value.importeDisplay])
  const movimientosVinculados = useMemo(() => factura?.movimientos ?? [], [factura])
  const importeYaPagado = useMemo(
    () => movimientosVinculados.reduce((sum, m) => sum + Math.abs(Number(m.importe)), 0),
    [movimientosVinculados],
  )
  const importePendiente = importeNumerico != null ? Math.max(importeNumerico - importeYaPagado, 0) : null

  const handleSubmit = async () => {
    if (!delegacionId) {
      toast.error("Selecciona una delegación antes de guardar la factura")
      return
    }
    if (value.importeDisplay.trim() && importeNumerico == null) {
      toast.error("El importe no es válido")
      return
    }

    const base = {
      contacto_id: value.contactoId,
      categoria_id: value.categoriaId,
      concepto: value.concepto.trim() || null,
      numero: value.numero.trim() || null,
      fecha_emision: value.fechaEmision,
      importe: importeNumerico,
      notas: value.notas.trim() || null,
    }

    setSaving(true)
    try {
      let facturaId = factura?.id
      if (isEdit && factura) {
        await onSave({ update: base })
      } else {
        const created = await onSave({ insert: { ...base, delegacion_id: delegacionId } })
        facturaId = created && "id" in created ? created.id : undefined
      }

      if (facturaId && seleccion) {
        await onLinkMovimiento(facturaId, seleccion, user?.id)
      }

      toast.success(isEdit ? "Factura actualizada" : "Factura creada")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo guardar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async (movimientoId: string) => {
    if (!factura) return
    try {
      await onUnlinkMovimiento(factura.id, movimientoId)
      toast.success("Movimiento desvinculado")
    } catch (err) {
      toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error desconocido"))
    }
  }

  const handlePagadaFuera = async () => {
    if (!factura) return
    try {
      await onMarcarPagadaFuera(factura.id)
      toast.success("Factura marcada como pagada fuera de MCM Bank")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo actualizar: " + (err instanceof Error ? err.message : "error desconocido"))
    }
  }

  const estadoInfo = factura ? FACTURA_ESTADO_INFO[factura.estado] : null
  const primerArchivo = factura?.archivos?.[0] ?? null
  const titulo = factura?.concepto?.trim() || primerArchivo?.nombre_original || (isEdit ? "Factura" : "Nueva factura")
  const puedeConciliar = factura ? factura.estado !== "pagada" && factura.estado !== "pagada_fuera" : true

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0 z-[60]">
        <SheetHeader className="border-b border-border/30 p-6 pb-4 space-y-3">
          <div className="flex items-start gap-3">
            {factura?.contacto ? (
              <EntityAvatar
                name={factura.contacto.nombre}
                emoji={factura.contacto.emoji}
                defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                colorHex={factura.contacto.color}
                size="lg"
                seed={`contacto:${factura.contacto.id}`}
                className="h-12 w-12 text-sm"
              />
            ) : null}
            <div className="flex-1 min-w-0 pr-8 space-y-1.5">
              <SheetTitle className="truncate text-xl tracking-tight">{titulo}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                {importeNumerico != null && <AmountDisplay amount={importeNumerico} size="lg" />}
                {estadoInfo && (
                  <StatusPill
                    label={estadoInfo.label}
                    icon={estadoInfo.icon}
                    bgClass={estadoInfo.bgClass}
                    textClass={estadoInfo.textClass}
                    borderClass={estadoInfo.borderClass}
                  />
                )}
              </div>
              {factura?.estado === "pagada_parcial" && importePendiente != null && (
                <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  Falta {formatCurrency(importePendiente)} por cubrir
                </div>
              )}
            </div>
            {canEdit && isEdit && factura && (
              <ActionMenu
                ariaLabel="Más acciones de la factura"
                items={[
                  ...(factura.estado !== "pagada_fuera"
                    ? [{ label: "Pagada fuera", icon: BadgeCheck, onSelect: handlePagadaFuera }]
                    : []),
                  { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => onDelete(factura) },
                ]}
              />
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <fieldset disabled={!canEdit} className="space-y-6 border-0 p-6 m-0 disabled:opacity-70">
            {/* Documento */}
            {(primerArchivo || isEdit) && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</h3>
                {primerArchivo && (
                  <div className="flex items-center gap-3">
                    <FileThumbnail
                      url={primerArchivo.url_publica}
                      mimeType={primerArchivo.tipo_mime}
                      nombre={primerArchivo.nombre_original}
                      className="h-24 w-20 shrink-0"
                    />
                    <a
                      href={primerArchivo.url_publica}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir en pestaña nueva
                    </a>
                  </div>
                )}
                {isEdit && factura && delegacionId && (
                  <FacturaArchivos facturaId={factura.id} delegacionId={delegacionId} />
                )}
              </div>
            )}

            {/* Lectura automática */}
            {isEdit && factura && (
              <>
                <Separator />
                <FacturaIaPanel
                  factura={factura}
                  canEdit={canEdit}
                  onChanged={() => onRefrescar?.()}
                  onCategoriaAceptada={(categoriaId) =>
                    setValue((prev) => ({ ...prev, categoriaId }))
                  }
                />
              </>
            )}

            <Separator />

            {/* Datos */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos</h3>
              <FacturaDatosFields
                value={value}
                onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
                contactos={contactos}
                categorias={categorias}
                onCreateContacto={
                  onCreateContacto
                    ? (initialNombre) => {
                        setContactoInitialNombre(initialNombre)
                        setContactoCreateOpen(true)
                      }
                    : undefined
                }
              />
            </div>

            {/* Conciliación */}
            {puedeConciliar && delegacionId && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Conciliación
                  </h3>
                  <FacturaConciliacionPanel
                    delegacionId={delegacionId}
                    importePendiente={importePendiente}
                    importeYaPagado={importeYaPagado}
                    fechaEmision={value.fechaEmision}
                    contactoId={value.contactoId}
                    seleccion={seleccion}
                    onSeleccionChange={setSeleccion}
                  />
                  {movimientosVinculados.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {movimientosVinculados.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {formatDate(m.fecha)} · {formatCurrency(Number(m.importe))} · {m.concepto}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnlink(m.id)}
                            className="shrink-0 rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/40"
                            title="Desvincular este movimiento"
                          >
                            <Unlink className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </fieldset>
        </ScrollArea>

        {canEdit && (
          <div className="flex items-center justify-end gap-2 border-t border-border/30 p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Guardando…
                </>
              ) : seleccion ? (
                "Guardar y conciliar"
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        )}

        {/* Creación rápida de contacto sin salir del panel */}
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
                    setValue((prev) => ({ ...prev, contactoId: created.id }))
                  }
                  return created
                }}
                onCancel={() => setContactoCreateOpen(false)}
                onSaved={() => setContactoCreateOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </SheetContent>
    </Sheet>
  )
}
