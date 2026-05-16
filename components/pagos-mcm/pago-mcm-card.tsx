"use client"

import { CheckCircle2, Copy, Edit3, ExternalLink, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"
import { CONTACTO_TIPO_INFO } from "@/lib/utils/contacto-tipos"
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

export function PagoMcmCard({ pago, canEdit, onEdit, onDelete, onMarcarPagado, onDesvincular }: PagoMcmCardProps) {
  const estadoInfo = PAGO_MCM_ESTADO_INFO[pago.estado]
  const tipoInfo = PAGO_MCM_TIPO_CALCULO_INFO[pago.tipo_calculo]
  const contactoTipoInfo = pago.contacto ? CONTACTO_TIPO_INFO[pago.contacto.tipo] : null
  const { copy } = useClipboard()

  const handleCopyIban = async () => {
    if (!pago.contacto?.iban) return
    const ok = await copy(pago.contacto.iban.replace(/\s+/g, ""))
    if (ok) toast.success("IBAN copiado")
  }

  const handleCopyImporte = async () => {
    const ok = await copy(Number(pago.importe).toFixed(2).replace(".", ","))
    if (ok) toast.success("Importe copiado")
  }

  return (
    <Card className={cn("transition-all hover:shadow-md", pago.estado === "cancelado" && "opacity-60")}>
      <CardContent className="p-4 space-y-3">
        {/* Estado + tipo cálculo */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              estadoInfo.bgClass,
              estadoInfo.textClass,
              estadoInfo.borderClass,
            )}
          >
            <span>{estadoInfo.emoji}</span>
            <span>{estadoInfo.label}</span>
          </span>
          <span className="text-[11px] text-muted-foreground" title={tipoInfo.descripcion}>
            {tipoInfo.emoji} {tipoInfo.label}
          </span>
        </div>

        {/* Concepto + importe */}
        <div>
          <div className="font-semibold text-base truncate" title={pago.concepto}>
            {pago.concepto}
          </div>
          <button
            type="button"
            onClick={handleCopyImporte}
            className="mt-1 text-2xl font-bold tabular-nums hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
            title="Copiar importe"
          >
            {formatCurrency(Number(pago.importe))}
          </button>
        </div>

        {/* Contacto */}
        {pago.contacto && (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
              style={{ backgroundColor: pago.contacto.color ?? contactoTipoInfo?.color }}
              aria-hidden
            >
              {pago.contacto.emoji ?? contactoTipoInfo?.emoji ?? "🧑"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{pago.contacto.nombre}</div>
              {pago.contacto.iban ? (
                <button
                  type="button"
                  onClick={handleCopyIban}
                  className="group flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                  title="Copiar IBAN"
                >
                  <span className="truncate">{formatearIban(pago.contacto.iban)}</span>
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ) : (
                <div className="text-[11px] text-amber-700 dark:text-amber-300">⚠️ Sin IBAN</div>
              )}
            </div>
          </div>
        )}

        {/* Descripción */}
        {pago.descripcion && (
          <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {pago.descripcion}
          </p>
        )}

        {/* Movimiento vinculado */}
        {pago.movimiento && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-[11px] text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">
              Vinculado a movimiento del {formatDate(pago.movimiento.fecha)} ·{" "}
              {formatCurrency(Number(pago.movimiento.importe))}
            </span>
          </div>
        )}

        {/* Botón "Marcar como pagado" destacado en pagos pendientes */}
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
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            Creado {formatDate(pago.creado_en)}
          </span>
          {canEdit && (
            <div className="flex items-center gap-1">
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
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
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
