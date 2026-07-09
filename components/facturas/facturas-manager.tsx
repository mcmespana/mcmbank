"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useContactos } from "@/hooks/use-contactos"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import useIsAdmin from "@/hooks/use-is-admin"
import { useFacturas } from "@/hooks/use-facturas"
import { formatCurrency } from "@/lib/utils/format"
import { FACTURA_ESTADO_INFO } from "@/lib/utils/facturas"
import type { FacturaConRelaciones, FacturaEstado } from "@/lib/types/database"
import { FacturaCard } from "./factura-card"
import { FacturaForm, type FacturaFormSubmit } from "./factura-form"
import { FacturaInboxDropzone } from "./factura-inbox-dropzone"
import { VincularMovimientoDialog } from "./vincular-movimiento-dialog"
import { DeleteFacturaDialog } from "./delete-factura-dialog"

type TabValue = "bandeja" | "sin_pagar" | "pagadas" | "todas"

const TAB_ORDER: TabValue[] = ["bandeja", "sin_pagar", "pagadas", "todas"]

const TAB_LABELS: Record<TabValue, string> = {
  bandeja: "Bandeja",
  sin_pagar: "Sin cerrar",
  pagadas: "Pagadas",
  todas: "Todas",
}

const TAB_ESTADOS: Record<Exclude<TabValue, "todas">, FacturaEstado[]> = {
  bandeja: ["bandeja"],
  sin_pagar: ["sin_pagar", "pagada_parcial"],
  pagadas: ["pagada", "pagada_fuera"],
}

export function FacturasManager() {
  const { selectedDelegation } = useDelegationContext()
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const { role } = useDelegationRole(selectedDelegation)
  const canEdit = isAdmin || role === "gestor_central" || role === "tesorero"
  const canManageGlobalContact = isAdmin || role === "gestor_central"

  const [tab, setTab] = useState<TabValue>("bandeja")
  const { value: busquedaDebounced, immediateValue: busqueda, setValue: setBusqueda } = useDebouncedState("", 250)

  const estadosForTab = useMemo<FacturaEstado[] | undefined>(() => {
    if (tab === "todas") return undefined
    return TAB_ESTADOS[tab]
  }, [tab])

  const {
    facturas,
    loading,
    error,
    refetch,
    createFactura,
    updateFactura,
    deleteFactura,
    linkToMovimiento,
    unlinkFromMovimiento,
  } = useFacturas(selectedDelegation, {
    estados: estadosForTab,
    busqueda: busquedaDebounced || undefined,
  })

  // Recuento global independiente del filtro de tab/búsqueda.
  const { totals: globalTotals, refetch: refetchTotals } = useFacturas(selectedDelegation, {})

  const { contactos, createContacto } = useContactos(selectedDelegation, { incluirGlobales: true })
  const { categorias } = useCategorias(selectedDelegation, { includeGlobal: true, includeInactive: false })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FacturaConRelaciones | null>(null)
  const [deleting, setDeleting] = useState<FacturaConRelaciones | null>(null)
  const [vinculando, setVinculando] = useState<FacturaConRelaciones | null>(null)

  const refreshAll = async () => {
    await Promise.all([refetch(), refetchTotals()])
  }

  const handleSubmitForm = async (payload: FacturaFormSubmit) => {
    if (editing) {
      if (!payload.update) return
      await updateFactura(editing.id, payload.update)
    } else {
      if (!payload.insert) return
      await createFactura({ ...payload.insert, creado_por: user?.id ?? null })
    }
    await refetchTotals()
    setFormOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (factura: FacturaConRelaciones) => {
    setEditing(factura)
    setFormOpen(true)
  }

  const marcarPagadaFuera = async (facturaId: string) => {
    await updateFactura(facturaId, { estado: "pagada_fuera" })
    await refetchTotals()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-2 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/30" />
            <h1 className="text-3xl font-extrabold sm:text-4xl bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Facturas
            </h1>
          </div>
          <p className="ml-5 max-w-2xl pl-4 text-sm text-muted-foreground">
            La bandeja de entrada de las facturas de la delegación. Sube los archivos según lleguen,
            apunta el proveedor y vincúlalas con su movimiento bancario en un par de clicks.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva factura
          </Button>
        )}
      </div>

      {/* Bandeja de entrada (dropzone) */}
      {canEdit && (
        <FacturaInboxDropzone
          delegacionId={selectedDelegation}
          onCreated={async () => {
            setTab("bandeja")
            await refreshAll()
          }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="En bandeja"
          value={String(globalTotals.bandeja)}
          sub="por revisar"
          icon={Inbox}
          accent="sky"
        />
        <KpiCard
          label="Sin cerrar"
          value={String(globalTotals.sin_pagar + globalTotals.pagada_parcial)}
          sub={
            globalTotals.pagada_parcial > 0
              ? `${globalTotals.pagada_parcial} con pago parcial`
              : globalTotals.sinPagarImporte > 0
                ? formatCurrency(globalTotals.sinPagarImporte)
                : "pendientes de pago"
          }
          icon={Clock}
          accent="amber"
        />
        <KpiCard
          label="Pagadas"
          value={String(globalTotals.pagada + globalTotals.pagada_fuera)}
          sub={
            globalTotals.pagada_fuera > 0
              ? `${globalTotals.pagada} vinculadas · ${globalTotals.pagada_fuera} fuera`
              : "conciliadas"
          }
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          label="Total"
          value={String(globalTotals.total)}
          sub="facturas"
          icon={ReceiptText}
          accent="primary"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-4 sm:mx-auto sm:flex sm:w-fit">
          {TAB_ORDER.map((t) => {
            const dotClass =
              t === "todas" ? null : FACTURA_ESTADO_INFO[TAB_ESTADOS[t][0]].dotClass
            const n =
              t === "todas"
                ? globalTotals.total
                : t === "bandeja"
                  ? globalTotals.bandeja
                  : t === "sin_pagar"
                    ? globalTotals.sin_pagar + globalTotals.pagada_parcial
                    : globalTotals.pagada + globalTotals.pagada_fuera
            return (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                {dotClass ? <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden /> : null}
                <span className="hidden sm:inline">{TAB_LABELS[t]}</span>
                <span className="sm:hidden">{TAB_LABELS[t].slice(0, 3)}</span>
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
          placeholder="Buscar por concepto, número o notas…"
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading && facturas.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas…
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
              ? "Arrastra los archivos de factura arriba y aparecerán aquí para revisar y conciliar."
              : tab === "sin_pagar"
                ? "Cuando registres una factura pendiente de pago, la verás en esta pestaña."
                : tab === "pagadas"
                  ? "Al vincular una factura con su movimiento (o marcarla pagada fuera) aparecerá aquí."
                  : "Sube la primera factura a la bandeja o créala a mano."
          }
        >
          {canEdit && tab !== "pagadas" && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Crear factura
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {facturas.map((factura) => (
            <FacturaCard
              key={factura.id}
              factura={factura}
              canEdit={canEdit}
              onEdit={() => openEdit(factura)}
              onDelete={() => setDeleting(factura)}
              onVincular={() => setVinculando(factura)}
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
                  await refetchTotals()
                  toast.success("Movimiento desvinculado")
                } catch (err) {
                  toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error"))
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Integraciones futuras */}
      <Card className="border-dashed border-border/70 bg-muted/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-primary" /> Próximamente
          </div>
          <div className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:gap-6">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              Buzón de email por delegación: reenvía la factura y aparecerá sola en la bandeja.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Lectura automática con IA: proveedor, fecha e importe rellenos al subir el archivo.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Formulario */}
      <Sheet open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-2">
            <SheetTitle>{editing ? "Editar factura" : "Nueva factura"}</SheetTitle>
          </SheetHeader>
          <FacturaForm
            delegacionId={selectedDelegation}
            factura={editing}
            contactos={contactos}
            categorias={categorias}
            canManageGlobalContact={canManageGlobalContact}
            onCreateContacto={async (payload) => {
              if (!payload.insert) return
              return await createContacto({ ...payload.insert, creado_por: user?.id ?? null })
            }}
            onSubmit={handleSubmitForm}
            onCancel={() => { setFormOpen(false); setEditing(null) }}
          />
        </SheetContent>
      </Sheet>

      {/* Vincular con movimiento */}
      {selectedDelegation && (
        <VincularMovimientoDialog
          factura={vinculando}
          open={Boolean(vinculando)}
          onOpenChange={(open) => !open && setVinculando(null)}
          delegacionId={selectedDelegation}
          onLink={async (facturaId, movimientoId, creadoPor) => {
            await linkToMovimiento(facturaId, movimientoId, creadoPor)
            await refetchTotals()
          }}
          onMarcarPagadaFuera={marcarPagadaFuera}
        />
      )}

      {/* Borrar */}
      <DeleteFacturaDialog
        factura={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={async (id) => {
          await deleteFactura(id)
          await refetchTotals()
          setDeleting(null)
          toast.success("Factura eliminada")
        }}
      />
    </div>
  )
}

type KpiAccent = "sky" | "amber" | "emerald" | "primary"

const ACCENT_CLASSES: Record<KpiAccent, { bg: string; icon: string; border: string }> = {
  sky: {
    bg: "bg-sky-50/70 dark:bg-sky-950/20",
    icon: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200/60 dark:border-sky-900/40",
  },
  amber: {
    bg: "bg-amber-50/70 dark:bg-amber-950/20",
    icon: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200/60 dark:border-amber-900/40",
  },
  emerald: {
    bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
    icon: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200/60 dark:border-emerald-900/40",
  },
  primary: {
    bg: "bg-primary/5",
    icon: "text-primary",
    border: "border-primary/20",
  },
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent: KpiAccent
}) {
  const a = ACCENT_CLASSES[accent]
  return (
    <Card className={cn("border", a.border)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
            <div className="truncate text-xl font-bold tracking-tight tabular-nums">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", a.bg)}>
            <Icon className={cn("h-4 w-4", a.icon)} aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
