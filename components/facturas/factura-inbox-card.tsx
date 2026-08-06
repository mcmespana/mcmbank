"use client"

import { FileText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionMenu } from "@/components/ui/action-menu"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { formatDate } from "@/lib/utils/format"
import { FACTURA_ORIGEN_INFO } from "@/lib/utils/facturas"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface FacturaInboxCardProps {
  factura: FacturaConRelaciones
  canEdit: boolean
  onOpenDetail: () => void
  onDelete: () => void
}

/**
 * Tarjeta de la Bandeja de Facturas, deliberadamente pequeña: ver el
 * documento es el trabajo, no leer datos. Única excepción del repo a
 * "una fila = un registro" (principio 2 del plan 021).
 */
export function FacturaInboxCard({ factura, canEdit, onOpenDetail, onDelete }: FacturaInboxCardProps) {
  const archivo = factura.archivos?.[0] ?? null
  const nombre = archivo?.nombre_original || factura.concepto?.trim() || "Factura sin título"
  const fechaSubida = archivo?.subido_en ?? factura.creado_en
  const OrigenIcon = FACTURA_ORIGEN_INFO[factura.origen].icon

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenDetail()
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border/50 bg-card p-2 shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:bg-muted/50 hover:border-border hover:shadow-md"
    >
      {canEdit && (
        <div className="absolute right-1.5 top-1.5 z-10" onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            ariaLabel={`Más acciones de ${nombre}`}
            items={[{ label: "Eliminar", icon: Trash2, destructive: true, onSelect: onDelete }]}
          />
        </div>
      )}

      {archivo ? (
        <FileThumbnail
          url={archivo.url_publica}
          mimeType={archivo.tipo_mime}
          nombre={archivo.nombre_original}
          className="aspect-[3/4] w-full"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
          <FileText className="h-8 w-8" aria-hidden />
        </div>
      )}

      <div className="space-y-0.5 px-0.5">
        <div className="line-clamp-2 text-xs font-medium leading-snug">{nombre}</div>
        <div className="text-[10px] text-muted-foreground">{formatDate(fechaSubida)}</div>
        {factura.origen === "email" && factura.email_remitente && (
          <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
            <OrigenIcon className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="truncate">{factura.email_remitente}</span>
          </div>
        )}
      </div>

      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetail()
          }}
        >
          Completar
        </Button>
      )}
    </div>
  )
}
