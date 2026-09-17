"use client"

import Link from "next/link"
import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { ExternalLink, Loader2, Receipt, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface PagoMcmTicketsProps {
  facturas: FacturaConRelaciones[]
  total: number
  uploading: boolean
  leyendo: boolean
  progreso: { done: number; total: number } | null
  listo: boolean
  onFiles: (files: File[]) => void
  onEliminar: (facturaId: string) => Promise<void>
  readOnly?: boolean
}

/**
 * Los tickets de un reembolso, que son facturas de la bandeja.
 *
 * Aquí es donde empieza el caso de "Aniceto pagó el Consum": el papel es una
 * factura del proveedor —se lee con IA y cuenta para su saldo— y el pago MCM
 * solo dice a quién hay que devolverle el dinero. Por eso cada línea enseña al
 * proveedor que ha leído la IA, no a la persona del pago.
 */
export function PagoMcmTickets({
  facturas,
  total,
  uploading,
  leyendo,
  progreso,
  listo,
  onFiles,
  onEliminar,
  readOnly,
}: PagoMcmTicketsProps) {
  const [eliminando, setEliminando] = useState<string | null>(null)
  const bloqueado = !listo || uploading || leyendo || Boolean(readOnly)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    multiple: true,
    disabled: bloqueado,
    maxSize: 20 * 1024 * 1024,
    noDragEventsBubbling: true,
  })

  const handleEliminar = async (facturaId: string) => {
    setEliminando(facturaId)
    try {
      await onEliminar(facturaId)
      toast.success("Ticket eliminado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el ticket")
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-2.5">
      {!readOnly && (
        <div
          {...getRootProps()}
          className={cn(
            "group/dz flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4 py-6 text-center transition-[border-color,background-color] duration-200",
            isDragActive ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-primary/[0.03]",
            bloqueado && "cursor-not-allowed opacity-60",
          )}
        >
          <input {...getInputProps()} />
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200",
              isDragActive ? "scale-110" : "group-hover/dz:scale-105",
            )}
          >
            {uploading || leyendo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Receipt className="h-5 w-5" />
            )}
          </div>
          {leyendo ? (
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Leyendo los tickets con IA…
            </div>
          ) : uploading && progreso ? (
            <div className="text-sm font-medium">
              Subiendo {Math.min(progreso.done + 1, progreso.total)} de {progreso.total}…
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold tracking-tight">
                {isDragActive ? "Suelta los tickets aquí" : "Arrastra los tickets"}
              </div>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Cada ticket se guarda como factura del proveedor y se lee con IA. El dinero se le debe a
                quien lo adelantó, no al proveedor.
              </p>
            </>
          )}
        </div>
      )}

      {facturas.length > 0 && (
        <div className="space-y-1.5">
          {facturas.map((factura) => {
            const proveedor = factura.contacto
            return (
              <div
                key={factura.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2"
              >
                <EntityAvatar
                  name={proveedor?.nombre ?? factura.concepto ?? "Ticket"}
                  emoji={proveedor?.emoji}
                  defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                  colorHex={proveedor?.color}
                  logoUrl={proveedor?.logo_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {proveedor?.nombre ?? factura.concepto ?? "Ticket sin identificar"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {factura.fecha_emision ? formatDate(factura.fecha_emision) : "Sin fecha"}
                    {factura.numero ? ` · ${factura.numero}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums">
                  {factura.importe != null ? formatCurrency(Math.abs(Number(factura.importe))) : "—"}
                </span>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  title="Abrir en Facturas"
                >
                  <Link href={`/facturas?factura=${factura.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleEliminar(factura.id)}
                    disabled={eliminando === factura.id}
                    title="Eliminar el ticket y su factura"
                  >
                    {eliminando === factura.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            )
          })}
          {facturas.length > 1 && (
            <p className="px-1 text-[11px] text-muted-foreground">
              Suman <span className="font-semibold tabular-nums">{formatCurrency(total)}</span> en{" "}
              {facturas.length} tickets.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
