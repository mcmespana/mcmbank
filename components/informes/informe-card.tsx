"use client"

import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EstadoBadge } from "./estado-badge"
import { ArchivoIcon } from "./archivo-icon"
import {
  getEstadoConfig,
  periodoDisplay,
  PERIODICIDAD_LABEL,
  type InformeEstado,
  type Periodicidad,
} from "@/lib/types/informes"
import type { InformeArchivo, InformeConArchivos } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Pencil, Trash2, ExternalLink, Eye, Sparkles, FileStack, TrendingUp, Wallet } from "lucide-react"

interface InformeCardProps {
  informe: InformeConArchivos
  canWrite: boolean
  onView: (archivo: InformeArchivo) => void
  onEdit: (informe: InformeConArchivos) => void
  onDelete: (informe: InformeConArchivos) => void
  onChangeEstado: (informe: InformeConArchivos, estado: InformeEstado) => void
}

export function InformeCard({
  informe,
  canWrite,
  onView,
  onEdit,
  onDelete,
  onChangeEstado,
}: InformeCardProps) {
  const archivos = informe.archivos ?? []
  const storageFiles = archivos.filter((a) => a.storage_path)
  const driveLinks = archivos.filter((a) => a.drive_url)
  const accent = getEstadoConfig(informe.estado).accentClass

  const balance = informe.balance_anual
  const disponible = informe.disponible_final
  const hasMoney = balance != null || disponible != null

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      {/* Franja de acento por estado */}
      <span className={cn("absolute inset-y-0 left-0 w-1.5", accent)} aria-hidden />

      <div className="flex flex-col gap-3 py-4 pl-6 pr-4 sm:flex-row sm:items-center sm:gap-6">
        {/* Bloque principal */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge
              estado={informe.estado}
              onChange={canWrite ? (e) => onChangeEstado(informe, e) : undefined}
            />
            <Badge variant="outline" className="text-[11px] font-medium">
              {periodoDisplay(informe)}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {PERIODICIDAD_LABEL[informe.periodicidad as Periodicidad] ?? informe.periodicidad}
            </Badge>
            {informe.es_borrador && (
              <Badge variant="outline" className="border-dashed text-[11px] text-muted-foreground">
                Borrador
              </Badge>
            )}
          </div>

          <h3 className="flex items-center gap-1.5 font-semibold leading-tight">
            {informe.origen === "generado" && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <span className="truncate">{informe.titulo}</span>
          </h3>

          {informe.notas && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{informe.notas}</p>
          )}

          {/* Archivos en línea */}
          {archivos.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {storageFiles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onView(a)}
                  className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted/60"
                >
                  <ArchivoIcon nombre={a.nombre} mime={a.mime_type} />
                  <span className="truncate">{a.nombre}</span>
                  <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {driveLinks.map((a) => (
                <a
                  key={a.id}
                  href={a.drive_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                  <ArchivoIcon nombre={a.nombre} isDrive />
                  <span className="truncate">{a.nombre}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
              {informe.drive_url && driveLinks.length === 0 && (
                <a
                  href={informe.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir en Drive
                </a>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileStack className="h-3.5 w-3.5" /> Sin archivos
            </div>
          )}
        </div>

        {/* Cifras económicas */}
        {hasMoney && (
          <div className="flex shrink-0 gap-4 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <Stat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Balance"
              value={balance}
              colorize
            />
            <Stat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Disponible"
              value={disponible}
            />
          </div>
        )}

        {/* Acciones */}
        {canWrite && (
          <div className="flex shrink-0 items-center gap-1 border-t pt-2 sm:border-0 sm:pt-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(informe)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(informe)}
              aria-label="Eliminar informe"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
  colorize,
}: {
  icon: ReactNode
  label: string
  value: number | null
  colorize?: boolean
}) {
  const color =
    colorize && value != null
      ? value > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : value < 0
          ? "text-red-600 dark:text-red-400"
          : "text-foreground"
      : "text-foreground"
  return (
    <div className="min-w-[5.5rem] text-right sm:text-left">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", color)}>
        {value != null ? formatCurrency(value) : "—"}
      </div>
    </div>
  )
}
