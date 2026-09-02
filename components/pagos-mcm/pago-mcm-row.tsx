"use client"

import { memo } from "react"
import { toast } from "sonner"
import { Ban, Check, CheckCircle2, Copy, Edit3, Trash2, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ListRow } from "@/components/ui/list-row"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { AmountDisplay } from "@/components/amount-display"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { StatusPill } from "@/components/ui/status-pill"
import { useClipboard } from "@/hooks/use-clipboard"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { formatDate } from "@/lib/utils/format"
import { formatearIban } from "@/lib/utils/iban"
import { PAGO_MCM_ESTADO_INFO, PAGO_MCM_TIPO_CALCULO_INFO } from "@/lib/utils/pago-mcm"
import type { PagoMcmConRelaciones } from "@/lib/types/database"

/** Plantilla de columnas compartida entre ListHeaderRow y PagoMcmRow (lg+). */
export const PAGO_MCM_ROW_COLS =
  "grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.7fr)_2.25rem]"

interface PagoMcmRowProps {
  pago: PagoMcmConRelaciones
  canEdit: boolean
  selected: boolean
  selectionActive: boolean
  onSelectionChange: (selected: boolean) => void
  onOpenDetail: () => void
  onEdit: () => void
  onDuplicate: () => void
  onCancel: () => void
  onDelete: () => void
  onMarcarPagado: () => void
  onConfirmarBorrador: () => void
  onDesvincular: () => void
}

export const PagoMcmRow = memo(function PagoMcmRow({
  pago,
  canEdit,
  selected,
  selectionActive,
  onSelectionChange,
  onOpenDetail,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
  onMarcarPagado,
  onConfirmarBorrador,
  onDesvincular,
}: PagoMcmRowProps) {
  const { copy } = useClipboard()
  const estadoInfo = PAGO_MCM_ESTADO_INFO[pago.estado]
  const tipoCalc = PAGO_MCM_TIPO_CALCULO_INFO[pago.tipo_calculo] ?? PAGO_MCM_TIPO_CALCULO_INFO.manual
  const importe = Number(pago.importe)

  const handleCopyIban = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pago.contacto?.iban) return
    const ok = await copy(pago.contacto.iban.replace(/\s+/g, ""))
    if (ok) toast.success("IBAN copiado")
  }

  const menuItems: ActionMenuItem[] = [
    { label: "Editar", icon: Edit3, onSelect: onEdit },
    { label: "Duplicar", icon: Copy, onSelect: onDuplicate },
    ...(pago.estado !== "cancelado" ? [{ label: "Cancelar", icon: Ban, onSelect: onCancel }] : []),
    ...(pago.movimiento ? [{ label: "Desvincular movimiento", icon: Unlink, onSelect: onDesvincular }] : []),
    { label: "Eliminar", icon: Trash2, destructive: true, onSelect: onDelete },
  ]

  const checkbox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={selected ? "Quitar de la selección" : "Seleccionar pago"}
      onClick={(e) => {
        e.stopPropagation()
        onSelectionChange(!selected)
      }}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-transparent hover:border-primary/50",
        !selectionActive && !selected && "opacity-40 hover:opacity-100",
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  )

  const beneficiarioBlock = (
    <div className="flex min-w-0 items-center gap-2.5">
      {checkbox}
      {pago.contacto ? (
        <EntityAvatar
          name={pago.contacto.nombre}
          emoji={pago.contacto.emoji}
          defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
          colorHex={pago.contacto.color}
          size="sm"
          seed={`contacto:${pago.contacto.id}`}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium tracking-tight">
            {pago.contacto?.nombre ?? "Sin contacto"}
          </span>
        </div>
        {pago.contacto && !pago.contacto.iban && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300">Sin IBAN</div>
        )}
      </div>
    </div>
  )

  const conceptoBlock = (
    <div className="min-w-0">
      <div className="truncate text-sm">{pago.concepto}</div>
      {pago.tipo_calculo !== "manual" && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <tipoCalc.icon className="h-3 w-3" aria-hidden />
          {tipoCalc.shortLabel}
        </div>
      )}
    </div>
  )

  const acciones = (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {canEdit && pago.contacto?.iban && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={handleCopyIban}
          title={`Copiar IBAN: ${formatearIban(pago.contacto.iban)}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
      {canEdit && pago.estado === "pendiente" && (
        <Button type="button" size="sm" variant="ghost" className="h-9 gap-1.5 px-2.5" onClick={onMarcarPagado}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Marcar pagado</span>
        </Button>
      )}
      {canEdit && pago.estado === "borrador" && (
        <Button type="button" size="sm" variant="ghost" className="h-9 gap-1.5 px-2.5" onClick={onConfirmarBorrador}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Confirmar</span>
        </Button>
      )}
      {canEdit && <ActionMenu ariaLabel={`Más acciones del pago ${pago.concepto}`} items={menuItems} />}
    </div>
  )

  // borderClass, no dotClass: mismo bug que en factura-row.tsx — dotClass es
  // un bg-* pensado para el puntito de estado, no para el accentClass de
  // ListRow, y pintaba toda la fila del color sólido.
  return (
    <ListRow accentClass={estadoInfo.borderClass} selected={selected} onClick={onOpenDetail}>
      {/* Móvil / tablet: dos líneas explícitas */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          {beneficiarioBlock}
          <div className="shrink-0 text-right">
            <AmountDisplay amount={importe} size="sm" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pl-[2.75rem]">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusPill
              label={estadoInfo.label}
              bgClass={estadoInfo.bgClass}
              textClass={estadoInfo.textClass}
              borderClass={estadoInfo.borderClass}
              size="sm"
            />
            <span className="truncate text-[11px] text-muted-foreground">{pago.concepto}</span>
          </div>
          {acciones}
        </div>
      </div>

      {/* Escritorio: columnas alineadas con ListHeaderRow */}
      <div className={cn("hidden items-center gap-3 lg:grid", PAGO_MCM_ROW_COLS)}>
        {beneficiarioBlock}
        {conceptoBlock}
        <AmountDisplay amount={importe} size="sm" />
        <div>
          {pago.categoria_sugerida ? (
            <span className="inline-flex items-center gap-1.5 truncate text-sm">
              <span>{pago.categoria_sugerida.emoji ?? "🏷️"}</span>
              <span className="truncate">{pago.categoria_sugerida.nombre}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{formatDate(pago.creado_en)}</div>
        {acciones}
      </div>
    </ListRow>
  )
})
