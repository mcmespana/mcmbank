"use client"

import { AlertTriangle, CalendarDays, FileText, Loader2, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { leerDatosIa } from "@/lib/types/factura-ia"
import { FACTURA_ORIGEN_INFO } from "@/lib/utils/facturas"
import type { BucketArchivo } from "@/lib/utils/signed-file-url"
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
  const ia = leerDatosIa(factura.datos_ia)
  const proveedor = factura.contacto?.nombre ?? null

  // Lo que hace falta para dar la factura por buena. Si la IA lo ha traído
  // todo, la tarjeta lo dice y el botón cambia de "Completar" a "Revisar":
  // no es lo mismo pedir trabajo que pedir un visto bueno.
  const faltan = [
    !factura.concepto?.trim() ? "concepto" : null,
    factura.importe == null ? "importe" : null,
    !factura.contacto_id ? "proveedor" : null,
    !factura.fecha_emision ? "fecha" : null,
  ].filter(Boolean) as string[]

  const leidaPorIa = ia?.estado === "listo"
  const dudosa = leidaPorIa && (ia?.es_factura === false || (ia?.confianza != null && ia.confianza < 0.5))
  const listaParaConfirmar = leidaPorIa && faltan.length === 0

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
      className="group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border/50 bg-card p-2 shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border hover:bg-muted/50 hover:shadow-md"
    >
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Eliminar ${nombre}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-1.5 top-1.5 z-10 h-8 w-8 rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {archivo ? (
        <FileThumbnail
          path={archivo.path_storage}
          bucket={archivo.bucket as BucketArchivo}
          mimeType={archivo.tipo_mime}
          nombre={archivo.nombre_original}
          className="aspect-[3/4] w-full"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
          <FileText className="h-8 w-8" aria-hidden />
        </div>
      )}

      {/* Estado de la lectura automática, en la propia miniatura: es lo que
          decide si esta factura pide trabajo o solo un vistazo. */}
      <div className="absolute left-1.5 top-1.5 z-10 flex flex-col items-start gap-1">
        {ia?.estado === "procesando" ? (
          <Insignia tono="neutro" icon={Loader2} spinning>
            Leyendo
          </Insignia>
        ) : dudosa ? (
          <Insignia tono="aviso" icon={AlertTriangle}>
            Revisar
          </Insignia>
        ) : listaParaConfirmar ? (
          <Insignia tono="ok" icon={Sparkles}>
            Leída por IA
          </Insignia>
        ) : leidaPorIa ? (
          <Insignia tono="neutro" icon={Sparkles}>
            Falta {faltan[0]}
          </Insignia>
        ) : null}
      </div>

      <div className="space-y-0.5 px-0.5">
        <div className="line-clamp-2 text-xs font-medium leading-snug">{nombre}</div>
        {/* Lo que ha sacado la lectura automática: sin esto habría que abrir
            cada tarjeta para saber si la factura ya tiene datos. */}
        {(proveedor || factura.importe != null) && (
          <div className="flex items-center gap-1 truncate text-[10px] text-foreground/80">
            {factura.contacto && (
              <EntityAvatar
                name={factura.contacto.nombre}
                emoji={factura.contacto.emoji}
                defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                colorHex={factura.contacto.color}
                logoUrl={factura.contacto.logo_url}
                size="sm"
                seed={`contacto:${factura.contacto.id}`}
                className="h-4 w-4 rounded-md text-[7px]"
              />
            )}
            <span className="truncate">
              {[proveedor, factura.importe != null ? formatCurrency(Math.abs(Number(factura.importe))) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
        {/* Dos fechas: la del papel y la de su llegada. Se distinguen por el
            icono (un calendario para la factura; el del origen —sobre, nube—
            para cuándo entró) y por el peso: la de la factura es la que se
            compara con el extracto del banco, así que va en primer lugar y con
            algo más de contraste. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {factura.fecha_emision && (
            <span
              className="inline-flex items-center gap-0.5 font-medium text-foreground/75"
              title={`Fecha de la factura: ${formatDate(factura.fecha_emision)}`}
            >
              <CalendarDays className="h-2.5 w-2.5 shrink-0" aria-hidden />
              {formatDate(factura.fecha_emision)}
            </span>
          )}
          <span
            className="inline-flex items-center gap-0.5"
            title={`${FACTURA_ORIGEN_INFO[factura.origen].label}: ${formatDate(fechaSubida)}`}
          >
            <OrigenIcon className="h-2.5 w-2.5 shrink-0" aria-hidden />
            {formatDate(fechaSubida)}
          </span>
        </div>
        {factura.origen === "email" && factura.email_remitente && (
          // El icono del sobre ya sale en la fecha de llegada, justo encima.
          <div className="truncate text-[10px] text-muted-foreground" title={factura.email_remitente}>
            {factura.email_remitente}
          </div>
        )}
      </div>

      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant={listaParaConfirmar ? "default" : "outline"}
          className="h-8 w-full text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetail()
          }}
        >
          {listaParaConfirmar ? "Revisar y confirmar" : "Completar"}
        </Button>
      )}
    </div>
  )
}

function Insignia({
  children,
  tono,
  icon: Icon,
  spinning,
}: {
  children: React.ReactNode
  tono: "ok" | "aviso" | "neutro"
  icon: typeof Sparkles
  spinning?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow-sm ring-1",
        tono === "ok"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-900"
          : tono === "aviso"
            ? "bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-900"
            : "bg-background/90 text-muted-foreground ring-border/60",
      )}
    >
      <Icon className={cn("h-2.5 w-2.5 shrink-0", spinning && "animate-spin")} aria-hidden />
      {children}
    </span>
  )
}
