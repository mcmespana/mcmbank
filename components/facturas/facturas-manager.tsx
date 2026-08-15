"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Clock, Inbox, Layers, Plus, ReceiptText, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PageHeader } from "@/components/ui/page-header"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { ListHeaderRow } from "@/components/ui/list-row"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useContactos } from "@/hooks/use-contactos"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { DatabaseService } from "@/lib/services/database"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import useIsAdmin from "@/hooks/use-is-admin"
import { useFacturas } from "@/hooks/use-facturas"
import { useFacturasResumen } from "@/hooks/use-facturas-resumen"
import { useSubirFacturas } from "@/hooks/use-subir-facturas"
import type { FacturaConRelaciones, FacturaEstado } from "@/lib/types/database"
import { FacturaRow, FACTURA_ROW_COLS } from "./factura-row"
import { FacturaInboxCard } from "./factura-inbox-card"
import { FacturaWorkspace, type FacturaWorkspaceSubmit } from "./factura-workspace"
import { FacturaInboxDropzone } from "./factura-inbox-dropzone"
import { FacturaDropOverlay } from "./factura-drop-overlay"
import { FacturaBuzonHint } from "./factura-buzon-hint"
import { DeleteFacturaDialog } from "./delete-factura-dialog"

type TabValue = "bandeja" | "sin_pagar" | "pagadas" | "todas"

const TAB_ORDER: TabValue[] = ["bandeja", "sin_pagar", "pagadas", "todas"]

const TAB_LABELS: Record<TabValue, string> = {
  bandeja: "Bandeja",
  // "Sin cerrar" describía el dato (ni pagada ni pagada fuera); "Pendientes"
  // describe lo que hay que hacer con ellas, que es lo que se está buscando
  // cuando se pulsa aquí.
  sin_pagar: "Pendientes",
  pagadas: "Pagadas",
  todas: "Todas",
}

const TAB_ICONS: Record<TabValue, typeof Inbox> = {
  bandeja: Inbox,
  sin_pagar: Clock,
  pagadas: CheckCircle2,
  todas: Layers,
}

const TAB_ESTADOS: Record<Exclude<TabValue, "todas">, FacturaEstado[]> = {
  bandeja: ["bandeja"],
  sin_pagar: ["sin_pagar", "pagada_parcial"],
  pagadas: ["pagada", "pagada_fuera"],
}

type FilterPillId = "sin_proveedor" | "sin_importe" | "falta_nif"

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function FacturasManager() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const { role } = useDelegationRole(selectedDelegation)
  const canEdit = isAdmin || role === "gestor_central" || role === "tesorero"
  const canManageGlobalContact = isAdmin || role === "gestor_central"

  const delegacionActual = getCurrentDelegation()

  const [tab, setTab] = useState<TabValue>("bandeja")
  const { value: busquedaDebounced, immediateValue: busqueda, setValue: setBusqueda } = useDebouncedState("", 250)
  const [activePills, setActivePills] = useState<Set<FilterPillId>>(new Set())

  const togglePill = (id: FilterPillId) => {
    setActivePills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const estadosForTab = useMemo<FacturaEstado[] | undefined>(() => {
    if (tab === "todas") return undefined
    return TAB_ESTADOS[tab]
  }, [tab])

  const {
    facturas: facturasSinFiltrarPills,
    loading,
    error,
    hasMore,
    onLoadMore,
    createFactura,
    updateFactura,
    deleteFactura,
    linkToMovimiento,
    unlinkFromMovimiento,
    refrescar,
  } = useFacturas(selectedDelegation, {
    estados: estadosForTab,
    busqueda: busquedaDebounced || undefined,
  })

  const { resumen: globalTotals, refetch: refetchTotals } = useFacturasResumen(selectedDelegation)

  const facturas = useMemo(() => {
    if (activePills.size === 0) return facturasSinFiltrarPills
    return facturasSinFiltrarPills.filter((f) => {
      if (activePills.has("sin_proveedor") && f.contacto_id) return false
      if (activePills.has("sin_importe") && f.importe != null) return false
      if (activePills.has("falta_nif") && !(f.contacto?.tipo === "proveedor" && !f.contacto?.identificador_fiscal)) {
        return false
      }
      return true
    })
  }, [facturasSinFiltrarPills, activePills])

  const { contactos, createContacto, refetch: refetchContactos } = useContactos(selectedDelegation, {
    incluirGlobales: true,
    incluirCatalogo: true,
  })
  const { categorias } = useCategorias(selectedDelegation, { includeGlobal: true, includeInactive: false })

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<FacturaConRelaciones | null>(null)
  // La factura que se ha pedido por URL y no está en la lista cargada.
  const [facturaSuelta, setFacturaSuelta] = useState<FacturaConRelaciones | null>(null)

  const detailFactura = detailId
    ? facturas.find((f) => f.id === detailId) ?? (facturaSuelta?.id === detailId ? facturaSuelta : null)
    : null

  // `/facturas?factura=<id>` abre esa factura directamente: es a donde apunta
  // el botón "Ver" de un movimiento conciliado. Puede no estar en la lista que
  // hay cargada (otra pestaña, otra página del scroll infinito), así que si no
  // aparece se pide suelta.
  const facturaEnUrl = searchParams.get("factura")
  useEffect(() => {
    if (!facturaEnUrl) return
    setDetailId(facturaEnUrl)
    setDetailOpen(true)

    let vigente = true
    if (!facturas.some((f) => f.id === facturaEnUrl)) {
      DatabaseService.getFacturaById(facturaEnUrl)
        .then((f) => {
          if (vigente) setFacturaSuelta(f)
        })
        .catch(() => undefined)
    }
    // El parámetro se limpia en cuanto se ha usado: si se quedara, cerrar el
    // panel y recargar volvería a abrirlo, y al navegar hacia atrás también.
    router.replace(pathname, { scroll: false })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaEnUrl])

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

  const refrescarTodo = useCallback(async () => {
    refrescar()
    await refetchTotals()
  }, [refrescar, refetchTotals])

  const subida = useSubirFacturas(selectedDelegation, refrescarTodo)

  // Las facturas nuevas caen siempre en la bandeja: si se sueltan estando en
  // otra pestaña, no tendría sentido dejar al usuario mirando una lista donde
  // no aparecen.
  const subirFacturas = subida.subir
  const subirYMostrarBandeja = useCallback(
    (files: File[]) => {
      setTab("bandeja")
      void subirFacturas(files)
    },
    [subirFacturas],
  )

  const openCreate = () => {
    setDetailId(null)
    setDetailOpen(true)
  }

  const openDetail = (factura: FacturaConRelaciones) => {
    setDetailId(factura.id)
    setDetailOpen(true)
  }

  const marcarPagadaFuera = async (facturaId: string) => {
    await updateFactura(facturaId, { estado: "pagada_fuera" })
  }

  const handleSaveDetail = async (payload: FacturaWorkspaceSubmit) => {
    if (detailFactura) {
      if (!payload.update) return
      await updateFactura(detailFactura.id, payload.update)
      return undefined
    }
    if (!payload.insert) return undefined
    return await createFactura({ ...payload.insert, creado_por: user?.id ?? null })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas"
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva factura
            </Button>
          ) : undefined
        }
      />

      <FilterTabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        items={TAB_ORDER.map((t) => ({
          value: t,
          label: TAB_LABELS[t],
          icon: TAB_ICONS[t],
          count:
            t === "todas"
              ? globalTotals.total
              : t === "bandeja"
                ? globalTotals.bandeja
                : t === "sin_pagar"
                  ? globalTotals.sin_pagar + globalTotals.pagada_parcial
                  : globalTotals.pagada + globalTotals.pagada_fuera,
        }))}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por concepto, número o notas…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={activePills.has("sin_proveedor")} onClick={() => togglePill("sin_proveedor")}>
            Sin proveedor
          </FilterPill>
          <FilterPill active={activePills.has("sin_importe")} onClick={() => togglePill("sin_importe")}>
            Sin importe
          </FilterPill>
          <FilterPill active={activePills.has("falta_nif")} onClick={() => togglePill("falta_nif")}>
            Falta NIF
          </FilterPill>
        </div>
      </div>

      {loading && facturas.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoadingSpinner size="sm" /> Cargando facturas…
        </div>
      ) : error ? (
        <EmptyState title="No se pudieron cargar las facturas" description={error} />
      ) : facturas.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title={
            tab === "bandeja"
              ? "La bandeja está vacía"
              : tab === "sin_pagar"
                ? "No hay facturas sin pagar"
                : tab === "pagadas"
                  ? "Aún no hay facturas pagadas"
                  : "Aún no hay facturas"
          }
          description={
            tab === "bandeja"
              ? "Suelta aquí los archivos de factura (o reenvíalos al buzón de la delegación) y aparecerán ya leídos, para revisar y conciliar."
              : "Sube la primera factura a la bandeja o créala a mano."
          }
        >
          {canEdit && tab !== "pagadas" && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Crear factura
            </Button>
          )}
        </EmptyState>
      ) : tab === "bandeja" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {facturas.map((factura) => (
            <FacturaInboxCard
              key={factura.id}
              factura={factura}
              canEdit={canEdit}
              onOpenDetail={() => openDetail(factura)}
              onDelete={() => setDeleting(factura)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <ListHeaderRow className={FACTURA_ROW_COLS}>
            <span>Proveedor</span>
            <span>Concepto</span>
            <span>Importe</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span />
          </ListHeaderRow>
          {facturas.map((factura) => (
            <FacturaRow
              key={factura.id}
              factura={factura}
              canEdit={canEdit}
              onOpenDetail={() => openDetail(factura)}
              onDelete={() => setDeleting(factura)}
              onMarcarPagadaFuera={async () => {
                try {
                  await marcarPagadaFuera(factura.id)
                  toast.success("Factura marcada como pagada fuera de MCM Bank")
                } catch (err) {
                  toast.error("No se pudo actualizar: " + (err instanceof Error ? err.message : "error"))
                }
              }}
              onDesvincular={async (movimientoId) => {
                try {
                  await unlinkFromMovimiento(factura.id, movimientoId)
                  toast.success("Movimiento desvinculado")
                } catch (err) {
                  toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error"))
                }
              }}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Subida al final: lo primero que se quiere ver al entrar son las
          facturas que esperan, no un recuadro vacío. Y soltar archivos ya no
          obliga a llegar hasta aquí — vale cualquier punto de la página
          (`FacturaDropOverlay`). */}
      {canEdit && tab === "bandeja" && (
        <div className="space-y-3 pt-2">
          <FacturaBuzonHint
            aliasEmail={delegacionActual?.alias_email}
            delegacionNombre={delegacionActual?.nombre}
          />
          <FacturaInboxDropzone
            onFiles={subida.subir}
            uploading={subida.uploading}
            leyendo={subida.leyendo}
            progreso={subida.progreso}
            disabled={!selectedDelegation}
          />
        </div>
      )}

      {canEdit && (
        <FacturaDropOverlay
          delegacionNombre={delegacionActual?.nombre}
          disabled={!selectedDelegation || subida.ocupado || detailOpen}
          onFiles={subirYMostrarBandeja}
        />
      )}

      <FacturaWorkspace
        factura={detailFactura}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setDetailId(null)
            setFacturaSuelta(null)
          }
        }}
        delegacionId={selectedDelegation}
        contactos={contactos}
        categorias={categorias}
        canEdit={canEdit}
        canManageGlobalContact={canManageGlobalContact}
        onCreateContacto={async (payload) => {
          if (!payload.insert) return
          return await createContacto({ ...payload.insert, creado_por: user?.id ?? null })
        }}
        onSave={handleSaveDetail}
        onLinkMovimiento={linkToMovimiento}
        onUnlinkMovimiento={unlinkFromMovimiento}
        onMarcarPagadaFuera={marcarPagadaFuera}
        onRefrescar={refrescarTodo}
        onContactosCambiados={refetchContactos}
        // El panel ya ha pedido confirmación con su botón de dos clics: abrir
        // aquí además el diálogo sería pedirla dos veces.
        onDelete={async (factura) => {
          await deleteFactura(factura.id)
          setDetailOpen(false)
          setDetailId(null)
          toast.success("Factura eliminada")
        }}
      />

      <DeleteFacturaDialog
        factura={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={async (id) => {
          await deleteFactura(id)
          setDeleting(null)
          toast.success("Factura eliminada")
        }}
      />
    </div>
  )
}
