"use client"

import { cn } from "@/lib/utils"
import { archivoKind, type ArchivoKind } from "@/lib/types/informes"
import { DriveIcon } from "./drive-icon"
import { FileText, FileSpreadsheet, FileType, File } from "lucide-react"

const ICONS: Record<Exclude<ArchivoKind, "drive">, { Icon: typeof FileText; className: string; label: string }> = {
  pdf: { Icon: FileText, className: "text-red-500", label: "PDF" },
  docx: { Icon: FileType, className: "text-blue-500", label: "Word" },
  xlsx: { Icon: FileSpreadsheet, className: "text-emerald-600", label: "Excel" },
  otro: { Icon: File, className: "text-muted-foreground", label: "Archivo" },
}

interface ArchivoIconProps {
  nombre: string
  mime?: string | null
  isDrive?: boolean
  className?: string
}

export function ArchivoIcon({ nombre, mime, isDrive, className }: ArchivoIconProps) {
  if (isDrive) return <DriveIcon className={className} />
  const kind = archivoKind(nombre, mime)
  const { Icon, className: colorClass } = ICONS[kind === "drive" ? "otro" : kind]
  return <Icon className={cn("h-4 w-4 shrink-0", colorClass, className)} />
}

export function getArchivoLabel(nombre: string, mime?: string | null, isDrive?: boolean): string {
  if (isDrive) return "Drive"
  const kind = archivoKind(nombre, mime)
  return ICONS[kind === "drive" ? "otro" : kind].label
}
