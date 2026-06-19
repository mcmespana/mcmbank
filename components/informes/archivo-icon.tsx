"use client"

import { cn } from "@/lib/utils"
import { archivoKind, type ArchivoKind } from "@/lib/types/informes"
import { FileText, FileSpreadsheet, FileType, ExternalLink, File } from "lucide-react"

const ICONS: Record<ArchivoKind, { Icon: typeof FileText; className: string; label: string }> = {
  pdf: { Icon: FileText, className: "text-red-500", label: "PDF" },
  docx: { Icon: FileType, className: "text-blue-500", label: "Word" },
  xlsx: { Icon: FileSpreadsheet, className: "text-emerald-600", label: "Excel" },
  drive: { Icon: ExternalLink, className: "text-amber-500", label: "Drive" },
  otro: { Icon: File, className: "text-muted-foreground", label: "Archivo" },
}

interface ArchivoIconProps {
  nombre: string
  mime?: string | null
  isDrive?: boolean
  className?: string
}

export function ArchivoIcon({ nombre, mime, isDrive, className }: ArchivoIconProps) {
  const kind: ArchivoKind = isDrive ? "drive" : archivoKind(nombre, mime)
  const { Icon, className: colorClass } = ICONS[kind]
  return <Icon className={cn("h-4 w-4 shrink-0", colorClass, className)} />
}

export function getArchivoLabel(nombre: string, mime?: string | null, isDrive?: boolean): string {
  const kind: ArchivoKind = isDrive ? "drive" : archivoKind(nombre, mime)
  return ICONS[kind].label
}
