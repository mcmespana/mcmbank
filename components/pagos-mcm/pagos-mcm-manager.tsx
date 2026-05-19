"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, CircleDashed, Clock, Coins, Copy, HandCoins, Loader2, Plus, Search, type LucideIcon } from "lucide-react"
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
import { useClipboard } from "@/hooks/use-clipboard"
import { useContactos } from "@/hooks/use-contactos"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import useIsAdmin from "@/hooks/use-is-admin"
import { usePagosMcm } from "@/hooks/use-pagos-mcm"
import { formatCurrency } from "@/lib/utils/format"
import { formatearIban } from "@/lib/utils/iban"
import { PAGO_MCM_ESTADO_INFO } from "@/lib/utils/pago-mcm"
import type {
  PagoMcmConRelaciones,
  PagoMcmEstado,
  PagoMcmInsert,
  PagoMcmUpdate,
} from "@/lib/types/database"
import { PagoMcmCard } from "./pago-mcm-card"
import { PagoMcmForm, type PagoMcmFormSubmit } from "./pago-mcm-form"
import { DeletePagoMcmDialog } from "./delete-pago-mcm-dialog"
import { MarcarPagadoDialog } from "./marcar-pagado-dialog"

type TabValue = "pendiente" | "borrador" | "pagado" | "todos"

const TAB_ORDER: TabValue[] = ["pendiente", "borrador", "pagado", "todos"]

const TAB_LABELS: Record<TabValue, string> = {
  pendiente: "Pendientes",
  borrador: "Borradores",
  pagado: "Pagados",
  todos: "Todos",
}

export function PagosMcmManager() {
  const { selectedDelegation } = useDelegationContext()
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
    totals,
    createPago,
    updatePago,
    deletePago,
    convertToMovimiento,
    linkToMovimiento,
    unlinkFromMovimiento,
  } = usePagosMcm(selectedDelegation, {
    estados: estadosForTab,
    busqueda: busquedaDebounced || undefined,
  })

  // El recuento total no depende del filtro de tab. Lo pedimos sin filtro de estado.
  const { totals: globalTotals } = usePagosMcm(selectedDelegation, {})

  const { contactos } = useContactos(selectedDelegation, { incluirGlobales: true })
  const { categorias } = useCategorias(selectedDelegation, { includeGlobal: true, includeInactive: false })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PagoMcmConRelaciones | null>(null)
  const [deleting, setDeleting] = useState<PagoMcmConRelaciones | null>(null)
  const [marcando, setMarcando] = useState<PagoMcmConRelaciones | null>(null)

  const { copy } = useClipboard()

  const pendientesConIban = useMemo(
    () => pagos.filter((p) => p.estado === "pendiente" && p.contacto?.iban),
    [pagos],
  )

  const handleCopyAllIbans = async () => {
    if (pendientesConIban.length === 0) {
      toast.info("No hay pagos pendientes con IBAN")
      return
    }
    const lines = pendientesConIban.map((p) => {
      const nombre = p.contacto?.nombre ?? "Contacto"
      const iban = formatearIban(p.contacto?.iban ?? "")
      return `${nombre} — ${iban} — ${formatCurrency(Number(p.importe))} — ${p.concepto}`
    })
    const ok = await copy(lines.join("\n"))
    if (ok) toast.success(`${lines.length} pagos copiados al portapapeles`)
  }

  const handleSubmitForm = async (payload: PagoMcmFormSubmit) => {
    if (editing) {
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
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-2 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/30" />
            <h1 className="text-3xl font-extrabold sm:text-4xl bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Pagos MCM
            </h1>
          </div>
          <p className="ml-5 max-w-2xl pl-4 text-sm text-muted-foreground">
            Apúntate los pagos internos que tienes que hacer (reembolsos a personas, ayudas, etc.).
            Ten a mano los IBAN, copia y pega para hacer las transferencias y, cuando estén hechas,
            vincula el movimiento bancario y desaparecerán de la lista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendientesConIban.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleCopyAllIbans}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar IBANes pendientes
            </Button>
          )}
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo pago MCM
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Pendiente"
          value={formatCurrency(globalTotals.pendienteImporte)}
          sub={`${globalTotals.pendiente} pago${globalTotals.pendiente === 1 ? "" : "s"}`}
          icon={Clock}
          accent="amber"
        />
        <KpiCard
          label="Borradores"
          value={String(globalTotals.borrador)}
          sub="por confirmar"
          icon={CircleDashed}
          accent="muted"
        />
        <KpiCard
          label="Pagados"
          value={String(globalTotals.pagado)}
          sub={`${formatCurrency(globalTotals.pagadoImporte)} acumulado`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          label="Total"
          value={String(globalTotals.total)}
          sub="registros"
          icon={Coins}
          accent="primary"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="w-full max-w-2xl grid grid-cols-4">
          {TAB_ORDER.map((t) => {
            const info = t === "todos" ? null : PAGO_MCM_ESTADO_INFO[t as PagoMcmEstado]
            const n =
              t === "todos"
                ? globalTotals.total
                : t === "pendiente"
                  ? globalTotals.pendiente
                  : t === "borrador"
                    ? globalTotals.borrador
                    : globalTotals.pagado
            return (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                {info ? (
                  <span className={cn("h-1.5 w-1.5 rounded-full", info.dotClass)} aria-hidden />
                ) : null}
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
          placeholder="Buscar por concepto, descripción o notas…"
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading && pagos.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando pagos…
        </div>
      ) : error ? (
        <EmptyState title="No se pudieron cargar los pagos" description={error} />
      ) : pagos.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-6 w-6" />}
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
              : tab === "borrador"
                ? "Los borradores te permiten dejar pagos a medio rellenar antes de confirmarlos."
                : tab === "pagado"
                  ? "Los pagos completados (con movimiento vinculado) aparecerán aquí."
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {pagos.map((pago) => (
            <PagoMcmCard
              key={pago.id}
              pago={pago}
              canEdit={canEdit}
              onEdit={() => openEdit(pago)}
              onDelete={() => setDeleting(pago)}
              onMarcarPagado={() => setMarcando(pago)}
              onDesvincular={async () => {
                try {
                  await unlinkFromMovimiento(pago.id)
                  toast.success("Movimiento desvinculado")
                } catch (err) {
                  toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error"))
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Formulario */}
      <Sheet open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-2">
            <SheetTitle>{editing ? "Editar pago MCM" : "Nuevo pago MCM"}</SheetTitle>
          </SheetHeader>
          <PagoMcmForm
            delegacionId={selectedDelegation}
            pago={editing}
            contactos={contactos}
            categorias={categorias}
            onSubmit={handleSubmitForm}
            onCancel={() => { setFormOpen(false); setEditing(null) }}
          />
        </SheetContent>
      </Sheet>

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

      {/* Borrar */}
      <DeletePagoMcmDialog
        pago={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={async (id) => {
          await deletePago(id)
          setDeleting(null)
          toast.success("Pago eliminado")
        }}
      />
    </div>
  )
}

type KpiAccent = "amber" | "emerald" | "muted" | "primary"

const ACCENT_CLASSES: Record<KpiAccent, { bg: string; icon: string; border: string }> = {
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
  muted: {
    bg: "bg-muted/50",
    icon: "text-muted-foreground",
    border: "border-border/60",
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

// Re-export submit type for parent usage if needed
export type { PagoMcmInsert, PagoMcmUpdate }
