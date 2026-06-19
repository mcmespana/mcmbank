"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EstadoBadge } from "./estado-badge"
import { ArchivoIcon } from "./archivo-icon"
import { periodoDisplay, PERIODICIDAD_LABEL, type InformeEstado, type Periodicidad } from "@/lib/types/informes"
import type { InformeArchivo, InformeConArchivos } from "@/lib/types/database"
import { cn } from "@/lib/utils"
import { Pencil, Trash2, ExternalLink, Eye, Sparkles, FileStack } from "lucide-react"

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

  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {informe.origen === "generado" && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <h3 className="truncate font-semibold leading-tight">{informe.titulo}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[11px]">
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
        </div>
        <EstadoBadge
          estado={informe.estado}
          onChange={canWrite ? (e) => onChangeEstado(informe, e) : undefined}
        />
      </div>

      {informe.notas && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{informe.notas}</p>
      )}

      {/* Archivos */}
      {archivos.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {storageFiles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onView(a)}
              className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <ArchivoIcon nombre={a.nombre} mime={a.mime_type} />
              <span className="flex-1 truncate">{a.nombre}</span>
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
          {driveLinks.map((a) => (
            <a
              key={a.id}
              href={a.drive_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border bg-amber-50 px-2.5 py-1.5 text-sm transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
            >
              <ArchivoIcon nombre={a.nombre} isDrive />
              <span className="flex-1 truncate">{a.nombre}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
          <FileStack className="h-3.5 w-3.5" /> Sin archivos
        </div>
      )}

      {/* Drive principal (informe generado) */}
      {informe.drive_url && driveLinks.length === 0 && (
        <a
          href={informe.drive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border bg-amber-50 px-2.5 py-1.5 text-sm transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
        >
          <ExternalLink className="h-3.5 w-3.5 text-amber-600" />
          <span className="flex-1 truncate">Abrir en Google Drive</span>
        </a>
      )}

      {canWrite && (
        <div className="mt-auto flex justify-end gap-1 border-t pt-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(informe)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("text-destructive hover:text-destructive")}
            onClick={() => onDelete(informe)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </Card>
  )
}
