"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  ArchiveRestore,
  Copy,
  Edit3,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useContactos } from "@/hooks/use-contactos"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import useIsAdmin from "@/hooks/use-is-admin"
import { useAuth } from "@/contexts/auth-context"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { CONTACTO_TIPO_DEFAULT_EMOJIS, CONTACTO_TIPO_INFO, CONTACTO_TIPO_ORDER } from "@/lib/utils/contacto-tipos"
import { formatearIban } from "@/lib/utils/iban"
import type { ContactoConCategoriaPredeterminada, ContactoTipo } from "@/lib/types/database"
import { ContactoForm, type ContactoFormSubmitPayload } from "./contacto-form"
import { ContactoDetailSheet } from "./contacto-detail-sheet"
import { ContactoTipoBadge } from "./contacto-tipo-badge"
import { DeleteContactoDialog } from "./delete-contacto-dialog"

type TabValue = "todos" | ContactoTipo

export function ContactosManager() {
  const { selectedDelegation } = useDelegationContext()
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const { role } = useDelegationRole(selectedDelegation)
  const canEdit = role === "gestor_central" || role === "administrador" || isAdmin
  const canManageGlobal = isAdmin

  const [tab, setTab] = useState<TabValue>("todos")
  const [incluirArchivados, setIncluirArchivados] = useState(false)
  const { value: busquedaDebounced, immediateValue: busqueda, setValue: setBusqueda } = useDebouncedState("", 250)

  const {
    contactos,
    loading,
    error,
    counts,
    createContacto,
    updateContacto,
    deleteContacto,
    archiveContacto,
  } = useContactos(selectedDelegation, {
    busqueda: busquedaDebounced || undefined,
    incluirArchivados,
  })

  const { categorias } = useCategorias(selectedDelegation, { includeGlobal: true, includeInactive: false })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContactoConCategoriaPredeterminada | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleting, setDeleting] = useState<ContactoConCategoriaPredeterminada | null>(null)

  const filtered = useMemo(() => {
    if (tab === "todos") return contactos
    return contactos.filter((c) => c.tipo === tab)
  }, [contactos, tab])

  const handleSubmitForm = async (payload: ContactoFormSubmitPayload) => {
    if (editing) {
      if (!payload.update) return
      await updateContacto(editing.id, payload.update)
      return undefined
    }
    if (!payload.insert) return
    return await createContacto({ ...payload.insert, creado_por: user?.id ?? null })
  }

  const openCreate = (tipo?: ContactoTipo) => {
    setEditing(null)
    setFormOpen(true)
    if (tipo) setTab(tipo)
  }
  const openEdit = (c: ContactoConCategoriaPredeterminada) => {
    setEditing(c)
    setFormOpen(true)
    setDetailOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-2 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/30" />
            <h1 className="text-3xl font-extrabold sm:text-4xl bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Contactos
            </h1>
          </div>
          <p className="ml-5 max-w-2xl pl-4 text-sm text-muted-foreground">
            Tu agenda para los movimientos: proveedores, personas MCM (socios, voluntarios) y destinatarios. Guarda IBAN, teléfono y notas, y vincúlalos a los movimientos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncluirArchivados((v) => !v)}
            className={cn(incluirArchivados && "bg-amber-100/40 dark:bg-amber-950/30")}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {incluirArchivados ? "Ocultar archivados" : "Ver archivados"}
          </Button>
          {canEdit && (
            <Button onClick={() => openCreate()}>
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo contacto
            </Button>
          )}
        </div>
      </div>

      {/* Tipo tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-4 sm:mx-auto sm:flex sm:w-fit">
          <TabsTrigger value="todos" className="gap-1.5">
            <span>Todos</span>
            {counts.total > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{counts.total}</span>}
          </TabsTrigger>
          {CONTACTO_TIPO_ORDER.map((t) => {
            const info = CONTACTO_TIPO_INFO[t]
            const n = counts[t]
            return (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", info.dotClass)} aria-hidden />
                <span className="hidden sm:inline">{info.shortLabel}</span>
                {n > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{n}</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* Buscador */}
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono, CIF/NIF o IBAN…"
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading && contactos.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando contactos…
        </div>
      ) : error ? (
        <EmptyState title="No se pudieron cargar los contactos" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={tab === "todos" ? "Aún no hay contactos" : "Sin contactos de este tipo"}
          description={
            tab === "todos"
              ? "Crea tu primer contacto para vincularlo a los movimientos y tener su IBAN y datos a mano."
              : `Crea el primer contacto de tipo "${CONTACTO_TIPO_INFO[tab as ContactoTipo].label}".`
          }
        >
          {canEdit && (
            <Button onClick={() => openCreate(tab === "todos" ? undefined : (tab as ContactoTipo))}>
              <Plus className="mr-1.5 h-4 w-4" /> Crear contacto
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <ContactoCard
              key={c.id}
              contacto={c}
              canEdit={canEdit && (!c.es_global || canManageGlobal)}
              onOpen={() => {
                setDetailId(c.id)
                setDetailOpen(true)
              }}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleting(c)}
              onArchive={() => archiveContacto(c.id, !c.archivado)}
            />
          ))}
        </div>
      )}

      {/* Form sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-2">
            <SheetTitle>{editing ? "Editar contacto" : "Nuevo contacto"}</SheetTitle>
          </SheetHeader>
          <ContactoForm
            delegacionId={selectedDelegation}
            contacto={editing}
            categorias={categorias}
            canManageGlobal={canManageGlobal}
            defaultTipo={tab === "todos" ? "proveedor" : (tab as ContactoTipo)}
            onSubmit={handleSubmitForm}
            onCancel={() => setFormOpen(false)}
            onSaved={() => setFormOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Detail */}
      <ContactoDetailSheet
        contactoId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
        onEdit={(c) => openEdit(c)}
        onArchive={(c) => archiveContacto(c.id, !c.archivado).then(() => toast.success(c.archivado ? "Desarchivado" : "Archivado"))}
        onDelete={(c) => {
          setDetailOpen(false)
          setDeleting(c)
        }}
      />

      {/* Delete dialog */}
      <DeleteContactoDialog
        contacto={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={async (id) => {
          await deleteContacto(id)
          setDeleting(null)
        }}
        onArchive={async (id) => {
          await archiveContacto(id, true)
          setDeleting(null)
        }}
      />
    </div>
  )
}

function ContactoCard({
  contacto,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
  onArchive,
}: {
  contacto: ContactoConCategoriaPredeterminada
  canEdit: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
}) {
  const { copy, isCopied } = useClipboard()

  const handleCopy = async (e: React.MouseEvent, value: string | null | undefined, label: string) => {
    e.stopPropagation()
    if (!value) return
    const ok = await copy(value)
    if (ok) toast.success(`${label} copiado`)
  }

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-[border-color,box-shadow,transform] hover:border-foreground/15 hover:shadow-md hover:-translate-y-0.5",
        contacto.archivado && "opacity-60",
      )}
      onClick={onOpen}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <EntityAvatar
            name={contacto.nombre}
            emoji={contacto.emoji}
            defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
            colorHex={contacto.color}
            size="lg"
            seed={`contacto:${contacto.id}`}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold tracking-tight">{contacto.nombre}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <ContactoTipoBadge tipo={contacto.tipo} size="sm" short />
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
            {contacto.identificador_fiscal && (
              <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{contacto.identificador_fiscal}</div>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          {contacto.iban && (
            <CopyChip
              label="IBAN"
              value={formatearIban(contacto.iban)}
              copied={isCopied(contacto.iban)}
              onCopy={(e) => handleCopy(e, contacto.iban, "IBAN")}
              mono
            />
          )}
          {contacto.email && (
            <CopyChip
              label="Email"
              value={contacto.email}
              copied={isCopied(contacto.email)}
              onCopy={(e) => handleCopy(e, contacto.email, "Email")}
            />
          )}
          {contacto.telefono && (
            <CopyChip
              label="Tel"
              value={contacto.telefono}
              copied={isCopied(contacto.telefono)}
              onCopy={(e) => handleCopy(e, contacto.telefono, "Teléfono")}
            />
          )}
        </div>

        {canEdit && (
          <div className="flex justify-end gap-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
              title={contacto.archivado ? "Desarchivar" : "Archivar"}
            >
              {contacto.archivado ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CopyChip({
  label,
  value,
  copied,
  onCopy,
  mono,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: (e: React.MouseEvent) => void
  mono?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-transparent bg-muted/40 px-2 py-1 text-left transition-colors hover:border-border/40 hover:bg-muted",
        copied && "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("flex-1 truncate", mono && "font-mono")}>{value}</span>
      <Copy className={cn("h-3 w-3 shrink-0", copied ? "text-green-600" : "text-muted-foreground")} />
    </button>
  )
}
