"use client"

import { useMemo, useState } from "react"
import { Copy, HandCoins, Loader2, Plus, Search } from "lucide-react"
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
          emoji="⏳"
        />
        <KpiCard
          label="Borradores"
          value={String(globalTotals.borrador)}
          sub="por confirmar"
          emoji="📝"
        />
        <KpiCard
          label="Pagados"
          value={String(globalTotals.pagado)}
          sub={`${formatCurrency(globalTotals.pagadoImporte)} acumulado`}
          emoji="✅"
        />
        <KpiCard
          label="Total"
          value={String(globalTotals.total)}
          sub="registros"
          emoji="💰"
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
              <TabsTrigger key={t} value={t}>
                <span className="mr-1">{info?.emoji ?? "📋"}</span>
                <span className="hidden sm:inline">{TAB_LABELS[t]}</span>
                {n > 0 && <span className="ml-1.5 text-[10px] text-muted-foreground">{n}</span>}
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

function KpiCard({ label, value, sub, emoji }: { label: string; value: string; sub?: string; emoji: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 truncate text-xl font-bold">{value}</div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
          </div>
          <div className={cn("text-2xl leading-none")} aria-hidden>
            {emoji}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Re-export submit type for parent usage if needed
export type { PagoMcmInsert, PagoMcmUpdate }
