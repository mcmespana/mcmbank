"use client"

import { CheckCircle2, Copy, Edit3, ExternalLink, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"
import { CONTACTO_TIPO_DEFAULT_EMOJIS, CONTACTO_TIPO_INFO } from "@/lib/utils/contacto-tipos"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { formatearIban } from "@/lib/utils/iban"
import { PAGO_MCM_ESTADO_INFO, PAGO_MCM_TIPO_CALCULO_INFO } from "@/lib/utils/pago-mcm"
import type { PagoMcmConRelaciones } from "@/lib/types/database"

interface PagoMcmCardProps {
  pago: PagoMcmConRelaciones
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onMarcarPagado?: () => void
  onDesvincular?: () => void
}

export function PagoMcmCard({
  pago,
  canEdit,
  onEdit,
  onDelete,
  onMarcarPagado,
  onDesvincular,
}: PagoMcmCardProps) {
  const estadoInfo = PAGO_MCM_ESTADO_INFO[pago.estado]
  const tipoCalc = PAGO_MCM_TIPO_CALCULO_INFO[pago.tipo_calculo]
  const contactoTipoInfo = pago.contacto ? CONTACTO_TIPO_INFO[pago.contacto.tipo] : null
  const TipoCalcIcon = tipoCalc.icon
  const { copy } = useClipboard()

  const importe = Number(pago.importe)

  const handleCopyIban = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pago.contacto?.iban) return
    const ok = await copy(pago.contacto.iban.replace(/\s+/g, ""))
    if (ok) toast.success("IBAN copiado")
  }

  const handleCopyImporte = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copy(importe.toFixed(2).replace(".", ","))
    if (ok) toast.success("Importe copiado")
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 transition-all hover:border-foreground/15 hover:shadow-md",
        pago.estado === "cancelado" && "opacity-60",
      )}
    >
      {/* Banda lateral coloreada por estado */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", estadoInfo.dotClass)} aria-hidden />

      <CardContent className="space-y-3.5 p-4 pl-[14px]">
        {/* Header: estado + tipo cálculo */}
        <div className="flex items-center justify-between gap-2">
          <StatusPill
            label={estadoInfo.label}
            icon={estadoInfo.icon}
            bgClass={estadoInfo.bgClass}
            textClass={estadoInfo.textClass}
            borderClass={estadoInfo.borderClass}
            size="sm"
          />
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"
            title={tipoCalc.descripcion}
          >
            <TipoCalcIcon className="h-3 w-3" aria-hidden />
            <span>{tipoCalc.shortLabel}</span>
          </span>
        </div>

        {/* Concepto + importe */}
        <div className="space-y-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight" title={pago.concepto}>
            {pago.concepto}
          </div>
          <button
            type="button"
            onClick={handleCopyImporte}
            className={cn(
              "inline-flex items-baseline gap-1 rounded text-2xl font-bold tracking-tight tabular-nums",
              "text-foreground hover:text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30",
            )}
            title="Copiar importe"
          >
            {formatCurrency(importe)}
            <Copy className="h-3 w-3 -translate-y-1 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Contacto + IBAN */}
        {pago.contacto && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2">
            <EntityAvatar
              name={pago.contacto.nombre}
              emoji={pago.contacto.emoji}
              defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
              colorHex={pago.contacto.color}
              size="md"
              seed={`contacto:${pago.contacto.id}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium tracking-tight">{pago.contacto.nombre}</span>
                {contactoTipoInfo && (
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", contactoTipoInfo.dotClass)}
                    aria-hidden
                    title={contactoTipoInfo.label}
                  />
                )}
              </div>
              {pago.contacto.iban ? (
                <button
                  type="button"
                  onClick={handleCopyIban}
                  className="group/iban mt-0.5 flex max-w-full items-center gap-1 text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                  title="Copiar IBAN"
                >
                  <span className="truncate font-mono">{formatearIban(pago.contacto.iban)}</span>
                  <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/iban:opacity-100" />
                </button>
              ) : (
                <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                  Sin IBAN guardado
                </div>
              )}
            </div>
          </div>
        )}

        {/* Descripción */}
        {pago.descripcion && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {pago.descripcion}
          </p>
        )}

        {/* Movimiento vinculado */}
        {pago.movimiento && (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {formatDate(pago.movimiento.fecha)} · {formatCurrency(Number(pago.movimiento.importe))}
            </span>
          </div>
        )}

        {/* Acción principal: marcar como pagado */}
        {canEdit && pago.estado === "pendiente" && onMarcarPagado && (
          <Button
            type="button"
            onClick={onMarcarPagado}
            size="sm"
            className="w-full"
            variant="default"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Marcar como pagado
          </Button>
        )}

        {/* Footer: fecha + acciones */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Creado {formatDate(pago.creado_en)}
          </span>
          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
              {pago.estado === "pagado" && onDesvincular && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDesvincular}
                  className="h-7 w-7 p-0"
                  title="Desvincular movimiento"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0" title="Editar">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
