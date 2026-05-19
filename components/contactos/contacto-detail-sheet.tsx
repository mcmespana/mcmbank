"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Edit3,
  Globe,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate, getAmountColorClass } from "@/lib/utils/format"
import { formatearIban } from "@/lib/utils/iban"
import { CONTACTO_TIPO_DEFAULT_EMOJIS, CONTACTO_TIPO_INFO } from "@/lib/utils/contacto-tipos"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { useClipboard } from "@/hooks/use-clipboard"
import { useContactoDetalle } from "@/hooks/use-contactos"
import { ContactoTipoBadge } from "./contacto-tipo-badge"
import type { ContactoConCategoriaPredeterminada } from "@/lib/types/database"

interface ContactoDetailSheetProps {
  contactoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (contacto: ContactoConCategoriaPredeterminada) => void
  onDelete: (contacto: ContactoConCategoriaPredeterminada) => void
  onArchive?: (contacto: ContactoConCategoriaPredeterminada) => void
  onCreateMovimiento?: (contacto: ContactoConCategoriaPredeterminada) => void
  canEdit: boolean
}

export function ContactoDetailSheet({
  contactoId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onArchive,
  onCreateMovimiento,
  canEdit,
}: ContactoDetailSheetProps) {
  const { contacto, movimientos, totales, loading, error } = useContactoDetalle(open ? contactoId : null)
  const { copy, isCopied } = useClipboard()
  const [tab, setTab] = useState("info")

  const tipoInfo = contacto ? CONTACTO_TIPO_INFO[contacto.tipo] : null

  const handleCopy = async (value: string | null | undefined, label: string) => {
    if (!value) return
    const ok = await copy(value)
    if (ok) toast.success(`${label} copiado`)
  }

  const direccionCompleta = useMemo(() => {
    if (!contacto) return null
    const parts = [contacto.direccion, [contacto.codigo_postal, contacto.ciudad].filter(Boolean).join(" ")]
      .filter(Boolean)
      .filter((part) => (part as string).trim().length > 0)
    return parts.length > 0 ? parts.join(", ") : null
  }, [contacto])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        {loading && !contacto && (
          <div className="flex flex-1 items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-6">
            <EmptyState title="No se pudo cargar el contacto" description={error} />
          </div>
        )}

        {contacto && tipoInfo && (
          <>
            <SheetHeader className="border-b border-border/30 p-6 pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <EntityAvatar
                  name={contacto.nombre}
                  emoji={contacto.emoji}
                  defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                  colorHex={contacto.color}
                  size="lg"
                  seed={`contacto:${contacto.id}`}
                  className="h-12 w-12 text-sm"
                />
                <div className="flex-1 min-w-0 pr-8">
                  <SheetTitle className="truncate text-xl tracking-tight">{contacto.nombre}</SheetTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ContactoTipoBadge tipo={contacto.tipo} size="sm" />
                    {contacto.es_global && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                        <Globe className="h-2.5 w-2.5" /> Global
                      </span>
                    )}
                    {contacto.archivado && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                        <Archive className="h-2.5 w-2.5" /> Archivado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {onCreateMovimiento && (
                  <Button size="sm" onClick={() => onCreateMovimiento(contacto)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Nuevo movimiento
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(contacto)} className="gap-1.5">
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
                {canEdit && onArchive && (
                  <Button size="sm" variant="outline" onClick={() => onArchive(contacto)} className="gap-1.5">
                    {contacto.archivado ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {contacto.archivado ? "Desarchivar" : "Archivar"}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(contacto)}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
              </div>
            </SheetHeader>

            <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
              <div className="px-6 pt-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Información</TabsTrigger>
                  <TabsTrigger value="movimientos">
                    Movimientos ({totales.total})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="info" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-6">
                    {contacto.identificador_fiscal && (
                      <CopyableRow
                        icon={<Hash className="h-4 w-4" />}
                        label="CIF / NIF / DNI"
                        value={contacto.identificador_fiscal}
                        onCopy={() => handleCopy(contacto.identificador_fiscal, "Identificador fiscal")}
                        copied={isCopied(contacto.identificador_fiscal)}
                      />
                    )}
                    {contacto.email && (
                      <CopyableRow
                        icon={<Mail className="h-4 w-4" />}
                        label="Email"
                        value={contacto.email}
                        onCopy={() => handleCopy(contacto.email, "Email")}
                        copied={isCopied(contacto.email)}
                      />
                    )}
                    {contacto.telefono && (
                      <CopyableRow
                        icon={<Phone className="h-4 w-4" />}
                        label="Teléfono"
                        value={contacto.telefono}
                        onCopy={() => handleCopy(contacto.telefono, "Teléfono")}
                        copied={isCopied(contacto.telefono)}
                      />
                    )}
                    {contacto.iban && (
                      <CopyableRow
                        icon={<span className="text-[10px] font-bold tracking-wider">IBAN</span>}
                        label="IBAN"
                        value={formatearIban(contacto.iban)}
                        copyValue={contacto.iban}
                        onCopy={() => handleCopy(contacto.iban, "IBAN")}
                        copied={isCopied(contacto.iban)}
                        mono
                      />
                    )}
                    {direccionCompleta && (
                      <CopyableRow
                        icon={<MapPin className="h-4 w-4" />}
                        label="Dirección"
                        value={direccionCompleta}
                        onCopy={() => handleCopy(direccionCompleta, "Dirección")}
                        copied={isCopied(direccionCompleta)}
                      />
                    )}
                    {contacto.categoria_predeterminada && (
                      <div className="rounded-xl border border-border/30 bg-card/40 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Categoría sugerida
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <span>{contacto.categoria_predeterminada.emoji ?? "🏷️"}</span>
                          <span>{contacto.categoria_predeterminada.nombre}</span>
                        </div>
                      </div>
                    )}
                    {contacto.notas && (
                      <div className="rounded-xl border border-border/30 bg-card/40 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{contacto.notas}</p>
                      </div>
                    )}
                    {!contacto.identificador_fiscal &&
                      !contacto.email &&
                      !contacto.telefono &&
                      !contacto.iban &&
                      !direccionCompleta &&
                      !contacto.categoria_predeterminada &&
                      !contacto.notas && (
                        <EmptyState
                          title="Sin datos adicionales"
                          description="Edita el contacto para añadir email, teléfono, IBAN o más detalles."
                        />
                      )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="movimientos" className="flex-1 overflow-hidden">
                <div className="grid grid-cols-3 gap-2 border-b border-border/30 p-4">
                  <Stat label="Ingresos" value={totales.ingresos} positive />
                  <Stat label="Gastos" value={totales.gastos} />
                  <Stat label="Neto" value={totales.neto} neutral />
                </div>
                <ScrollArea className="h-[calc(100%-5rem)]">
                  <div className="p-4">
                    {movimientos.length === 0 ? (
                      <EmptyState
                        title="Sin movimientos vinculados"
                        description="Vincula este contacto desde un movimiento existente o crea uno nuevo."
                      />
                    ) : (
                      <ul className="space-y-1.5">
                        {movimientos.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {m.importe >= 0 ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                                )}
                                <span className="truncate font-medium">{m.concepto}</span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{formatDate(m.fecha)}</span>
                                {m.categoria && (
                                  <span className="inline-flex items-center gap-1">
                                    <span>{m.categoria.emoji ?? "🏷️"}</span>
                                    <span className="truncate">{m.categoria.nombre}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn("text-sm tabular-nums", getAmountColorClass(m.importe))}>
                              {formatCurrency(m.importe)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function CopyableRow({
  icon,
  label,
  value,
  copyValue,
  onCopy,
  copied,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  copyValue?: string
  onCopy: () => void
  copied: boolean
  mono?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-transparent bg-card/40 px-3 py-2 text-left transition-all hover:border-border/50 hover:bg-card",
        copied && "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900",
      )}
      title="Copiar"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("truncate text-sm", mono && "font-mono")}>{value}</div>
      </div>
      <Copy className={cn("h-4 w-4 shrink-0", copied ? "text-green-600" : "text-muted-foreground")} />
    </button>
  )
}

function Stat({ label, value, positive, neutral }: { label: string; value: number; positive?: boolean; neutral?: boolean }) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          !neutral && (positive ? "text-green-600" : value < 0 ? "text-red-600" : ""),
        )}
      >
        {formatCurrency(value)}
      </div>
    </div>
  )
}
