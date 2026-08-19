"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Copy, Plus, Search, Wallet } from "lucide-react"
import { toast } from "sonner"
import { describirError } from "@/lib/utils/describir-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PageHeader } from "@/components/ui/page-header"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { ListHeaderRow } from "@/components/ui/list-row"
import { ActionMenu } from "@/components/ui/action-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useClipboard } from "@/hooks/use-clipboard"
import { useContactos } from "@/hooks/use-contactos"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import useIsAdmin from "@/hooks/use-is-admin"
import { usePagosMcm } from "@/hooks/use-pagos-mcm"
import { usePagosMcmResumen } from "@/hooks/use-pagos-mcm-resumen"
import { formatCurrency } from "@/lib/utils/format"
import { COPY_FORMATS, getPagosTransferibles, type CopyFormatId } from "@/lib/utils/copy-formats"
import { PAGO_MCM_ESTADO_INFO } from "@/lib/utils/pago-mcm"
import type { Categoria, PagoMcmConRelaciones, PagoMcmEstado } from "@/lib/types/database"
import { PagoMcmRow, PAGO_MCM_ROW_COLS } from "./pago-mcm-row"
import { PagoMcmForm, type PagoMcmFormSubmit } from "./pago-mcm-form"
import { PagoMcmDetailSheet } from "./pago-mcm-detail-sheet"
import { DeletePagoMcmDialog } from "./delete-pago-mcm-dialog"
import { MarcarPagadoDialog } from "./marcar-pagado-dialog"
import { TransferRunDialog } from "./transfer-run-dialog"
import { CategoryQuickCreateSheet } from "@/components/transactions/category-quick-create-sheet"

type TabValue = "pendiente" | "borrador" | "pagado" | "todos"

const TAB_ORDER: TabValue[] = ["pendiente", "borrador", "pagado", "todos"]

const TAB_LABELS: Record<TabValue, string> = {
  pendiente: "Pendientes",
  borrador: "Borradores",
  pagado: "Pagados",
  todos: "Todos",
}

export function PagosMcmManager() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const { role } = useDelegationRole(selectedDelegation)
  const canEdit = isAdmin || role === "gestor_central" || role === "tesorero"

  const [tab, setTab] = useState<TabValue>("pendiente")
  const { value: busquedaDebounced, immediateValue: busqueda, setValue: setBusqueda } = useDebouncedState("", 250)

  const estadosForTab = useMemo<PagoMcmEstado[] | undefined>(() => {
    if (tab === "todos") return undefined
    return [tab as PagoMcmEstado]
  }, [tab])

  const {
    pagos,
    loading,
    error,
    hasMore,
    onLoadMore,
    createPago,
    updatePago,
    deletePago,
    restorePago,
    convertToMovimiento,
    linkToMovimiento,
    unlinkFromMovimiento,
  } = usePagosMcm(selectedDelegation, {
    estados: estadosForTab,
    busqueda: busquedaDebounced || undefined,
  })

  const { resumen: globalTotals } = usePagosMcmResumen(selectedDelegation)

  // Pendientes con IBAN, independiente de la pestaña activa (antes se calculaba
  // sobre `pagos`, que está filtrado por tab, así que en "Pagados" caía a 0).
  const { pagos: pendientesRaw } = usePagosMcm(selectedDelegation, { estados: ["pendiente"] })
  const pendientesConIban = useMemo(() => getPagosTransferibles(pendientesRaw), [pendientesRaw])

  const { contactos } = useContactos(selectedDelegation, { incluirGlobales: true })
  const { categorias } = useCategorias(selectedDelegation, { includeGlobal: true, includeInactive: false })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PagoMcmConRelaciones | null>(null)
  const [deleting, setDeleting] = useState<PagoMcmConRelaciones | null>(null)
  const [marcando, setMarcando] = useState<PagoMcmConRelaciones | null>(null)
  const [detailPago, setDetailPago] = useState<PagoMcmConRelaciones | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSubset, setTransferSubset] = useState<PagoMcmConRelaciones[] | null>(null)
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false)
  const pendingCategoryAssignRef = useRef<((categoryId: string) => void | Promise<void>) | null>(null)

  const { copy } = useClipboard()

  const selectionActive = selectedIds.size > 0
  const pagosSeleccionados = useMemo(() => pagos.filter((p) => selectedIds.has(p.id)), [pagos, selectedIds])
  const borradoresSeleccionados = useMemo(
    () => pagosSeleccionados.filter((p) => p.estado === "borrador"),
    [pagosSeleccionados],
  )

  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) onLoadMore()
    })
    const current = loadMoreRef.current
    if (current) observer.observe(current)
    return () => {
      if (current) observer.unobserve(current)
    }
  }, [hasMore, onLoadMore])

  const handleCopyFormat = async (formatId: CopyFormatId) => {
    setCopyMenuOpen(false)
    if (pendientesConIban.length === 0) {
      toast.info("No hay pagos pendientes con IBAN")
      return
    }
    const fmt = COPY_FORMATS[formatId]
    const text = fmt.build(pendientesConIban)
    const ok = await copy(text)
    if (ok) {
      toast.success(`${pendientesConIban.length} pagos copiados`, { description: fmt.label })
    }
  }

  const handleSubmitForm = async (payload: PagoMcmFormSubmit) => {
    if (editing?.id) {
      if (!payload.update) return
      await updatePago(editing.id, payload.update)
    } else {
      if (!payload.insert) return
      await createPago({ ...payload.insert, creado_por: user?.id ?? null })
    }
    setFormOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (pago: PagoMcmConRelaciones) => {
    setEditing(pago)
    setFormOpen(true)
    setDetailOpen(false)
  }

  const openDuplicate = (pago: PagoMcmConRelaciones) => {
    setEditing({ ...pago, id: "", movimiento_id: null, movimiento: null })
    setFormOpen(true)
    setDetailOpen(false)
  }

  const openDetail = (pago: PagoMcmConRelaciones) => {
    setDetailPago(pago)
    setDetailOpen(true)
  }

  const handleCancelar = async (pago: PagoMcmConRelaciones) => {
    try {
      await updatePago(pago.id, { estado: "cancelado" })
      toast.success("Pago cancelado")
    } catch (err) {
      toast.error("No se pudo cancelar: " + (err instanceof Error ? err.message : "error"))
    }
  }

  const handleConfirmarBorrador = async (pago: PagoMcmConRelaciones) => {
    try {
      await updatePago(pago.id, { estado: "pendiente" })
      toast.success("Pago confirmado como pendiente")
    } catch (err) {
      toast.error("No se pudo confirmar: " + (err instanceof Error ? err.message : "error"))
    }
  }

  const handleConfirmarBorradoresSeleccionados = async () => {
    try {
      await Promise.all(borradoresSeleccionados.map((p) => updatePago(p.id, { estado: "pendiente" })))
      toast.success(`${borradoresSeleccionados.length} borrador(es) confirmados`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error("No se pudieron confirmar todos: " + (err instanceof Error ? err.message : "error"))
    }
  }

  const handleDesvincular = async (pago: PagoMcmConRelaciones) => {
    try {
      await unlinkFromMovimiento(pago.id)
      toast.success("Movimiento desvinculado")
    } catch (err) {
      toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error"))
    }
  }

  const toggleSelection = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const openTransferencia = (subset?: PagoMcmConRelaciones[]) => {
    setTransferSubset(subset ?? null)
    setTransferOpen(true)
  }

  const requestCreateCategory = (assign: (categoryId: string) => void | Promise<void>) => {
    pendingCategoryAssignRef.current = assign
    setCategoryCreateOpen(true)
  }

  const handleCategoryCreated = async (newCategory: Categoria) => {
    const assign = pendingCategoryAssignRef.current
    pendingCategoryAssignRef.current = null
    setCategoryCreateOpen(false)
    if (assign) await assign(newCategory.id)
    toast.success(`Categoría "${newCategory.nombre}" creada y asignada`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos MCM"
        actions={
          <>
            {pendientesConIban.length > 0 && canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => openTransferencia()}
                title="Asistente paso a paso para hacer todas las transferencias"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Modo transferencia
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
                  {pendientesConIban.length}
                </span>
              </Button>
            )}
            {pendientesConIban.length > 0 && (
              <Popover open={copyMenuOpen} onOpenChange={setCopyMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar IBANes
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-1">
                  {(Object.keys(COPY_FORMATS) as CopyFormatId[]).map((id) => {
                    const fmt = COPY_FORMATS[id]
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleCopyFormat(id)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="font-medium">{fmt.label}</span>
                        <span className="text-[11px] leading-tight text-muted-foreground">{fmt.description}</span>
                      </button>
                    )
                  })}
                </PopoverContent>
              </Popover>
            )}
            {pendientesConIban.length > 0 && (
              <ActionMenu
                ariaLabel="Más acciones de pagos pendientes"
                items={[
                  ...(canEdit
                    ? [{ label: "Modo transferencia", icon: Wallet, onSelect: () => openTransferencia() }]
                    : []),
                  {
                    label: "Copiar IBANes",
                    icon: Copy,
                    onSelect: () => handleCopyFormat(Object.keys(COPY_FORMATS)[0] as CopyFormatId),
                  },
                ]}
              />
            )}
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" /> Nuevo pago
              </Button>
            )}
          </>
        }
      />

      <FilterTabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        items={TAB_ORDER.map((t) => ({
          value: t,
          label: TAB_LABELS[t],
          dotClass: t === "todos" ? undefined : PAGO_MCM_ESTADO_INFO[t as PagoMcmEstado].dotClass,
          count:
            t === "todos"
              ? globalTotals.total
              : t === "pendiente"
                ? globalTotals.pendiente
                : t === "borrador"
                  ? globalTotals.borrador
                  : globalTotals.pagado,
        }))}
      />

      <p className="text-sm text-muted-foreground">
        {globalTotals.pendiente} pago{globalTotals.pendiente === 1 ? "" : "s"} pendiente
        {globalTotals.pendiente === 1 ? "" : "s"} · {formatCurrency(globalTotals.pendienteImporte)}
      </p>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por concepto, descripción o notas…"
          className="pl-9"
        />
      </div>

      {selectionActive && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold tracking-tight">{selectedIds.size} pago(s) seleccionados</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {borradoresSeleccionados.length > 0 && (
                <Button size="sm" variant="secondary" onClick={handleConfirmarBorradoresSeleccionados}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirmar borradores ({borradoresSeleccionados.length})
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const subset = pagosSeleccionados.filter((p) => p.estado === "pendiente" && p.contacto?.iban)
                  openTransferencia(subset.length > 0 ? subset : undefined)
                }}
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Modo transferencia ({selectedIds.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Cancelar selección
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && pagos.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoadingSpinner size="sm" /> Cargando pagos…
        </div>
      ) : error ? (
        <EmptyState title="No se pudieron cargar los pagos" description={error} />
      ) : pagos.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={
            tab === "pendiente"
              ? "No tienes pagos pendientes"
              : tab === "borrador"
                ? "Sin borradores"
                : tab === "pagado"
                  ? "Aún no hay pagos completados"
                  : "Aún no hay pagos MCM"
          }
          description={
            tab === "pendiente"
              ? "Cuando alguien adelante un gasto, créalo aquí para no olvidarte de devolverle el dinero."
              : "Crea tu primer pago MCM para empezar a registrar reembolsos y ayudas."
          }
        >
          {canEdit && tab !== "pagado" && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Crear pago MCM
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-1">
          <ListHeaderRow className={PAGO_MCM_ROW_COLS}>
            <span>Beneficiario</span>
            <span>Concepto</span>
            <span>Importe</span>
            <span>Categoría</span>
            <span>Fecha</span>
            <span />
          </ListHeaderRow>
          {pagos.map((pago) => (
            <PagoMcmRow
              key={pago.id}
              pago={pago}
              canEdit={canEdit}
              selected={selectedIds.has(pago.id)}
              selectionActive={selectionActive}
              onSelectionChange={(selected) => toggleSelection(pago.id, selected)}
              onOpenDetail={() => openDetail(pago)}
              onEdit={() => openEdit(pago)}
              onDuplicate={() => openDuplicate(pago)}
              onCancel={() => handleCancelar(pago)}
              onDelete={() => setDeleting(pago)}
              onMarcarPagado={() => setMarcando(pago)}
              onConfirmarBorrador={() => handleConfirmarBorrador(pago)}
              onDesvincular={() => handleDesvincular(pago)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Formulario */}
      <Sheet open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-2">
            <SheetTitle>
              {editing?.id ? "Editar pago MCM" : editing ? "Duplicar pago MCM" : "Nuevo pago MCM"}
            </SheetTitle>
          </SheetHeader>
          <PagoMcmForm
            delegacionId={selectedDelegation}
            pago={editing}
            contactos={contactos}
            categorias={categorias}
            onRequestCreateCategory={requestCreateCategory}
            onSubmit={handleSubmitForm}
            onCancel={() => { setFormOpen(false); setEditing(null) }}
          />
        </SheetContent>
      </Sheet>

      <CategoryQuickCreateSheet
        open={categoryCreateOpen}
        onOpenChange={(open) => {
          setCategoryCreateOpen(open)
          if (!open) pendingCategoryAssignRef.current = null
        }}
        organizacionId={getCurrentDelegation()?.organizacion_id}
        delegacionId={selectedDelegation}
        canManageGlobal={isAdmin}
        categories={categorias}
        onCreated={handleCategoryCreated}
      />

      {/* Detalle */}
      <PagoMcmDetailSheet
        pago={detailPago}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        delegacionId={selectedDelegation}
        canEdit={canEdit}
        onEdit={openEdit}
        onMarcarPagado={(pago) => {
          setDetailOpen(false)
          setMarcando(pago)
        }}
        onConfirmarBorrador={handleConfirmarBorrador}
        onDesvincular={handleDesvincular}
        onDuplicate={openDuplicate}
        onCancel={handleCancelar}
        onDelete={(pago) => {
          setDetailOpen(false)
          setDeleting(pago)
        }}
      />

      {/* Marcar como pagado */}
      {selectedDelegation && (
        <MarcarPagadoDialog
          pago={marcando}
          open={Boolean(marcando)}
          onOpenChange={(open) => !open && setMarcando(null)}
          delegacionId={selectedDelegation}
          onConvert={convertToMovimiento}
          onLink={linkToMovimiento}
        />
      )}

      {/* Modo transferencia (wizard) */}
      {selectedDelegation && (
        <TransferRunDialog
          pagos={transferSubset ?? pendientesConIban}
          open={transferOpen}
          onOpenChange={(open) => {
            setTransferOpen(open)
            if (!open) {
              setTransferSubset(null)
              setSelectedIds(new Set())
            }
          }}
          delegacionId={selectedDelegation}
          onConvert={convertToMovimiento}
        />
      )}

      {/* Borrar */}
      <DeletePagoMcmDialog
        pago={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={async (id) => {
          const fila = await deletePago(id)
          setDeleting(null)
          // Mismo trato que el borrado en lote de movimientos: se recupera el
          // pago con su id original, no una copia. Los adjuntos no se tocan al
          // borrar, así que aquí sí vuelve todo.
          toast.success("Pago eliminado", {
            duration: 12000,
            action: fila
              ? {
                  label: "Deshacer",
                  onClick: () => {
                    restorePago(fila)
                      .then(() => toast.success("Pago recuperado"))
                      .catch((err) => toast.error(describirError(err, "No se ha podido recuperar el pago")))
                  },
                }
              : undefined,
          })
        }}
      />
    </div>
  )
}
