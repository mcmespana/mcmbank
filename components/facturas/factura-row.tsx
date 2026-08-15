"use client"

import { memo, useState } from "react"
import { BadgeCheck, Edit3, Link2, Paperclip, Trash2, Unlink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ListRow } from "@/components/ui/list-row"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { FacturaImporte } from "./factura-importe"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { FACTURA_ESTADO_INFO, importePendienteFactura } from "@/lib/utils/facturas"
import type { FacturaConRelaciones } from "@/lib/types/database"

/** Plantilla de columnas compartida entre ListHeaderRow y FacturaRow (lg+). */
export const FACTURA_ROW_COLS =
  "grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_2.25rem]"

interface FacturaRowProps {
  factura: FacturaConRelaciones
  canEdit: boolean
  onOpenDetail: () => void
  onDelete: () => void
  onMarcarPagadaFuera: () => void
  onDesvincular: (movimientoId: string) => void
}

export const FacturaRow = memo(function FacturaRow({
  factura,
  canEdit,
  onOpenDetail,
  onDelete,
  onMarcarPagadaFuera,
  onDesvincular,
}: FacturaRowProps) {
  const [elegirDesvincular, setElegirDesvincular] = useState(false)
  const estadoInfo = FACTURA_ESTADO_INFO[factura.estado]
  const pendiente = importePendienteFactura(factura)
  const movimientos = factura.movimientos ?? []
  const abierta = factura.estado !== "pagada" && factura.estado !== "pagada_fuera"
  const faltaNif = factura.contacto?.tipo === "proveedor" && !factura.contacto?.identificador_fiscal

  const titulo =
    factura.concepto?.trim() || factura.archivos?.[0]?.nombre_original || "Factura sin título"

  const handleDesvincular = () => {
    if (movimientos.length === 1) {
      onDesvincular(movimientos[0].id)
    } else if (movimientos.length > 1) {
      setElegirDesvincular(true)
    }
  }

  const menuItems: ActionMenuItem[] = [
    { label: "Editar", icon: Edit3, onSelect: onOpenDetail },
    ...(factura.estado !== "pagada_fuera"
      ? [{ label: "Pagada fuera", icon: BadgeCheck, onSelect: onMarcarPagadaFuera }]
      : []),
    ...(movimientos.length > 0
      ? [{ label: "Desvincular movimiento", icon: Unlink, onSelect: handleDesvincular }]
      : []),
    { label: "Eliminar", icon: Trash2, destructive: true, onSelect: onDelete },
  ]

  const proveedorBlock = (
    <div className="flex min-w-0 items-center gap-2.5">
      {factura.contacto ? (
        <EntityAvatar
          name={factura.contacto.nombre}
          emoji={factura.contacto.emoji}
          defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
          colorHex={factura.contacto.color}
          logoUrl={factura.contacto.logo_url}
          size="sm"
          seed={`contacto:${factura.contacto.id}`}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium tracking-tight">
            {factura.contacto?.nombre ?? "Sin proveedor"}
          </span>
          {faltaNif && (
            <span
              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              title="Falta el NIF/CIF de este proveedor"
            >
              !
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const conciliacionInfo = (
    <>
      <StatusPill
        label={estadoInfo.label}
        bgClass={estadoInfo.bgClass}
        textClass={estadoInfo.textClass}
        borderClass={estadoInfo.borderClass}
        size="sm"
      />
      {movimientos.length > 0 && <span className="text-[11px] text-muted-foreground">{movimientos.length} mov.</span>}
      {factura.archivos && factura.archivos.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
          <Paperclip className="h-3 w-3" /> {factura.archivos.length}
        </span>
      )}
    </>
  )

  const acciones = (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {canEdit && abierta && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 px-2.5"
          onClick={onOpenDetail}
          title="Vincular con un movimiento del banco"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Vincular</span>
        </Button>
      )}
      {canEdit && <ActionMenu ariaLabel={`Más acciones de la factura ${titulo}`} items={menuItems} />}
    </div>
  )

  return (
    <>
      {/* borderClass, no dotClass: dotClass es "bg-emerald-500" (para el puntito
          de los badges) — pasado como accentClass, ListRow pintaba TODA la fila
          de verde sólido en vez de solo el borde izquierdo, dejando el texto
          casi ilegible. borderClass ya es un color de borde sutil. */}
      <ListRow accentClass={estadoInfo.borderClass} onClick={onOpenDetail}>
        {/* Móvil / tablet: dos líneas explícitas */}
        <div className="flex flex-col gap-1.5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {proveedorBlock}
              <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">— {titulo}</span>
            </div>
            <div className="shrink-0 text-right">
              {factura.importe != null ? (
                <FacturaImporte importe={Number(factura.importe)} estado={factura.estado} size="sm" />
              ) : (
                <span className="text-xs italic text-muted-foreground">Sin importe</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {conciliacionInfo}
              <span className="text-[11px] text-muted-foreground">
                {factura.fecha_emision ? formatDate(factura.fecha_emision) : "Sin fecha"}
              </span>
              {factura.estado === "pagada_parcial" && pendiente != null && (
                <span className="text-[11px] font-medium text-orange-700 dark:text-orange-300">
                  Falta {formatCurrency(pendiente)}
                </span>
              )}
            </div>
            {acciones}
          </div>
        </div>

        {/* Escritorio: columnas alineadas con ListHeaderRow */}
        <div className={cn("hidden items-center gap-3 lg:grid", FACTURA_ROW_COLS)}>
          {proveedorBlock}

          <div className="min-w-0">
            <div className="truncate text-sm">{titulo}</div>
            {factura.numero && <div className="truncate text-[11px] text-muted-foreground">Nº {factura.numero}</div>}
          </div>

          <div>
            {factura.importe != null ? (
              <FacturaImporte importe={Number(factura.importe)} estado={factura.estado} size="sm" />
            ) : (
              <span className="text-xs italic text-muted-foreground">Sin importe</span>
            )}
            {factura.estado === "pagada_parcial" && pendiente != null && (
              <div className="mt-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
                Falta {formatCurrency(pendiente)}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"}
          </div>

          <div className="flex items-center gap-1.5">{conciliacionInfo}</div>

          {acciones}
        </div>
      </ListRow>

      {/* Elegir qué movimiento desvincular cuando hay varios */}
      <Dialog open={elegirDesvincular} onOpenChange={setElegirDesvincular}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué movimiento desvinculamos?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {movimientos.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {formatDate(m.fecha)} · {formatCurrency(Number(m.importe))} · {m.concepto}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                  onClick={() => {
                    onDesvincular(m.id)
                    setElegirDesvincular(false)
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" /> Desvincular
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setElegirDesvincular(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})
