"use client"

import { toast } from "sonner"
import { Ban, CheckCircle2, Copy, Edit3, ExternalLink, Trash2, Unlink } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ActionMenu } from "@/components/ui/action-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { AmountDisplay } from "@/components/amount-display"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { Separator } from "@/components/ui/separator"
import { useClipboard } from "@/hooks/use-clipboard"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { formatearIban } from "@/lib/utils/iban"
import { PAGO_MCM_ESTADO_INFO, PAGO_MCM_TIPO_CALCULO_INFO, calcularImporteGasolinaKm } from "@/lib/utils/pago-mcm"
import { PagoMcmArchivos } from "./pago-mcm-archivos"
import type { PagoMcmConRelaciones } from "@/lib/types/database"

interface PagoMcmDetailSheetProps {
  pago: PagoMcmConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string | null
  canEdit: boolean
  onEdit: (pago: PagoMcmConRelaciones) => void
  onMarcarPagado: (pago: PagoMcmConRelaciones) => void
  onConfirmarBorrador: (pago: PagoMcmConRelaciones) => Promise<void>
  onDesvincular: (pago: PagoMcmConRelaciones) => Promise<void>
  onDuplicate: (pago: PagoMcmConRelaciones) => void
  onCancel: (pago: PagoMcmConRelaciones) => Promise<void>
  onDelete: (pago: PagoMcmConRelaciones) => void
}

/** Estructura tomada de contacto-detail-sheet.tsx: cabecera fija + cuerpo en ScrollArea. */
export function PagoMcmDetailSheet({
  pago,
  open,
  onOpenChange,
  delegacionId,
  canEdit,
  onEdit,
  onMarcarPagado,
  onConfirmarBorrador,
  onDesvincular,
  onDuplicate,
  onCancel,
  onDelete,
}: PagoMcmDetailSheetProps) {
  const { copy } = useClipboard()

  if (!pago) return null

  const estadoInfo = PAGO_MCM_ESTADO_INFO[pago.estado]
  const tipoCalc = PAGO_MCM_TIPO_CALCULO_INFO[pago.tipo_calculo] ?? PAGO_MCM_TIPO_CALCULO_INFO.manual
  const importe = Number(pago.importe)

  const handleCopyIban = async () => {
    if (!pago.contacto?.iban) return
    const ok = await copy(pago.contacto.iban.replace(/\s+/g, ""))
    if (ok) toast.success("IBAN copiado")
  }

  const desgloseGasolina =
    pago.tipo_calculo === "gasolina_km" && pago.gasolina_km_un_trayecto != null && pago.gasolina_precio_km != null
      ? {
          km: Number(pago.gasolina_km_un_trayecto),
          idaVuelta: pago.gasolina_ida_vuelta,
          precio: Number(pago.gasolina_precio_km),
          total: calcularImporteGasolinaKm(
            Number(pago.gasolina_km_un_trayecto),
            pago.gasolina_ida_vuelta,
            Number(pago.gasolina_precio_km),
          ),
        }
      : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0 z-[60]">
        <SheetHeader className="border-b border-border/30 p-6 pb-4 space-y-3">
          <div className="flex items-start gap-3">
            {pago.contacto ? (
              <EntityAvatar
                name={pago.contacto.nombre}
                emoji={pago.contacto.emoji}
                defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                colorHex={pago.contacto.color}
                size="lg"
                seed={`contacto:${pago.contacto.id}`}
                className="h-12 w-12 text-sm"
              />
            ) : null}
            <div className="flex-1 min-w-0 pr-8 space-y-1.5">
              <SheetTitle className="truncate text-xl tracking-tight">
                {pago.contacto?.nombre ?? "Pago MCM"}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <AmountDisplay amount={importe} size="lg" />
                <StatusPill
                  label={estadoInfo.label}
                  icon={estadoInfo.icon}
                  bgClass={estadoInfo.bgClass}
                  textClass={estadoInfo.textClass}
                  borderClass={estadoInfo.borderClass}
                />
              </div>
              <p className="truncate text-sm text-muted-foreground">{pago.concepto}</p>
            </div>
            {canEdit && (
              <ActionMenu
                ariaLabel="Más acciones del pago"
                items={[
                  { label: "Editar", icon: Edit3, onSelect: () => onEdit(pago) },
                  { label: "Duplicar", icon: Copy, onSelect: () => onDuplicate(pago) },
                  ...(pago.estado !== "cancelado"
                    ? [{ label: "Cancelar", icon: Ban, onSelect: () => onCancel(pago) }]
                    : []),
                  { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => onDelete(pago) },
                ]}
              />
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {/* Beneficiario */}
            {pago.contacto && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beneficiario</h3>
                {pago.contacto.iban ? (
                  <button
                    type="button"
                    onClick={handleCopyIban}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-card/40 px-3 py-2 text-left transition-colors hover:border-border/50 hover:bg-card"
                    title="Copiar IBAN"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[10px] font-bold text-muted-foreground">
                      IBAN
                    </div>
                    <div className="min-w-0 flex-1 truncate font-mono text-sm">
                      {formatearIban(pago.contacto.iban)}
                    </div>
                    <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ) : (
                  <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    Este contacto no tiene IBAN guardado.
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Desglose del cálculo */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cálculo</h3>
              {desgloseGasolina ? (
                <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {desgloseGasolina.km} km{desgloseGasolina.idaVuelta ? " × 2" : ""} ×{" "}
                    {desgloseGasolina.precio.toFixed(2).replace(".", ",")} €
                  </div>
                  <div className="text-lg font-bold tracking-tight tabular-nums">
                    {formatCurrency(desgloseGasolina.total)}
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <tipoCalc.icon className="h-3.5 w-3.5" aria-hidden />
                  {tipoCalc.label}
                </div>
              )}
            </div>

            <Separator />

            {/* Justificantes */}
            {delegacionId && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Justificantes
                </h3>
                <PagoMcmArchivos pagoId={pago.id} delegacionId={delegacionId} />
              </div>
            )}

            <Separator />

            {/* Movimiento vinculado o marcar pagado */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Movimiento</h3>
              {pago.movimiento ? (
                <div className="flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2.5 py-2 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {formatDate(pago.movimiento.fecha)} · {formatCurrency(Number(pago.movimiento.importe))} ·{" "}
                    {pago.movimiento.concepto}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDesvincular(pago)}
                      className="shrink-0 rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/40"
                      title="Desvincular este movimiento"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : canEdit && pago.estado === "pendiente" ? (
                <Button type="button" onClick={() => onMarcarPagado(pago)} className="w-full">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Marcar como pagado
                </Button>
              ) : canEdit && pago.estado === "borrador" ? (
                <Button type="button" onClick={() => onConfirmarBorrador(pago)} className="w-full">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar como pendiente
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">Sin movimiento vinculado.</div>
              )}
            </div>

            {pago.descripcion && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">{pago.descripcion}</p>
                </div>
              </>
            )}

            {pago.notas && (
              <div className={cn("space-y-1", !pago.descripcion && "pt-0")}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notas internas
                </h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{pago.notas}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
