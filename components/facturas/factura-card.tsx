"use client"

import { BadgeCheck, Edit3, ExternalLink, FileText, Link2, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { CONTACTO_TIPO_DEFAULT_EMOJIS, CONTACTO_TIPO_INFO } from "@/lib/utils/contacto-tipos"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { FACTURA_ESTADO_INFO, FACTURA_ORIGEN_INFO, importePendienteFactura } from "@/lib/utils/facturas"
import { getSignedFileUrl } from "@/lib/utils/signed-file-url"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface FacturaCardProps {
  factura: FacturaConRelaciones
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onVincular?: () => void
  onDesvincular?: (movimientoId: string) => void
  onMarcarPagadaFuera?: () => void
}

export function FacturaCard({
  factura,
  canEdit,
  onEdit,
  onDelete,
  onVincular,
  onDesvincular,
  onMarcarPagadaFuera,
}: FacturaCardProps) {
  const estadoInfo = FACTURA_ESTADO_INFO[factura.estado]
  const origenInfo = FACTURA_ORIGEN_INFO[factura.origen]
  const OrigenIcon = origenInfo.icon
  const contactoTipoInfo = factura.contacto ? CONTACTO_TIPO_INFO[factura.contacto.tipo] : null
  const archivoPrincipal = factura.archivos?.[0] ?? null
  const movimientos = factura.movimientos ?? []
  const pendiente = importePendienteFactura(factura)
  // "Sigue abierta" = puede admitir más vínculos (bandeja, sin_pagar, pago parcial)
  const abierta = factura.estado !== "pagada" && factura.estado !== "pagada_fuera"

  const titulo =
    factura.concepto?.trim() ||
    archivoPrincipal?.nombre_original ||
    "Factura sin título"

  const handleOpenArchivo = async (archivo: NonNullable<FacturaConRelaciones["archivos"]>[number]) => {
    try {
      const url = await getSignedFileUrl(archivo.path_storage, archivo.bucket as "facturas" | "documentos")
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo")
    }
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-md",
      )}
    >
      {/* Banda lateral coloreada por estado */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", estadoInfo.dotClass)} aria-hidden />

      <CardContent className="space-y-3.5 p-4 pl-[14px]">
        {/* Header: estado + origen */}
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
            title={origenInfo.label}
          >
            <OrigenIcon className="h-3 w-3" aria-hidden />
          </span>
        </div>

        {/* Título + importe + fecha */}
        <div className="space-y-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight" title={titulo}>
            {titulo}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            {factura.importe != null ? (
              <span className="text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(Number(factura.importe))}
              </span>
            ) : (
              <span className="text-sm italic text-muted-foreground">Sin importe</span>
            )}
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {factura.fecha_emision ? formatDate(factura.fecha_emision) : "Sin fecha"}
              {factura.numero && <span className="ml-1.5">· Nº {factura.numero}</span>}
            </span>
          </div>
          {factura.estado === "pagada_parcial" && pendiente != null && (
            <div className="text-[11px] font-medium text-orange-700 dark:text-orange-300">
              Quedan {formatCurrency(pendiente)} por cubrir
            </div>
          )}
        </div>

        {/* Proveedor */}
        {factura.contacto ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2">
            <EntityAvatar
              name={factura.contacto.nombre}
              emoji={factura.contacto.emoji}
              defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
              colorHex={factura.contacto.color}
              size="md"
              seed={`contacto:${factura.contacto.id}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium tracking-tight">{factura.contacto.nombre}</span>
                {contactoTipoInfo && (
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", contactoTipoInfo.dotClass)}
                    aria-hidden
                    title={contactoTipoInfo.label}
                  />
                )}
                {factura.contacto.tipo === "proveedor" && !factura.contacto.identificador_fiscal && (
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    title="Falta el NIF/CIF de este proveedor"
                  >
                    !
                  </span>
                )}
              </div>
              {factura.contacto.identificador_fiscal && (
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {factura.contacto.identificador_fiscal}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
            Sin proveedor asignado
          </div>
        )}

        {/* Archivos */}
        {factura.archivos && factura.archivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {factura.archivos.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleOpenArchivo(a)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                title={a.nombre_original}
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.nombre_original}</span>
              </button>
            ))}
          </div>
        )}

        {/* Movimientos vinculados (puede haber varios: pago en varios plazos) */}
        {movimientos.length > 0 && (
          <div className="space-y-1">
            {movimientos.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {formatDate(m.fecha)} · {formatCurrency(Number(m.importe))} · {m.concepto}
                </span>
                {canEdit && onDesvincular && (
                  <button
                    type="button"
                    onClick={() => onDesvincular(m.id)}
                    className="shrink-0 rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/40"
                    title="Desvincular este movimiento"
                  >
                    <Unlink className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Acción principal: vincular movimiento */}
        {canEdit && abierta && onVincular && (
          <div className="flex gap-2">
            <Button type="button" onClick={onVincular} size="sm" className="flex-1">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {movimientos.length > 0 ? "Vincular otro pago" : "Vincular movimiento"}
            </Button>
            {onMarcarPagadaFuera && (
              <Button
                type="button"
                onClick={onMarcarPagadaFuera}
                size="sm"
                variant="outline"
                title="Pagada, pero el movimiento está fuera de MCM Bank"
              >
                <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Pagada fuera
              </Button>
            )}
          </div>
        )}

        {/* Footer: fecha + acciones */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {origenInfo.value === "email" && factura.email_remitente
              ? `De ${factura.email_remitente}`
              : `Creada ${formatDate(factura.creado_en)}`}
          </span>
          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
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
