"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Landmark, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { ListRow } from "@/components/ui/list-row"
import { StatusPill } from "@/components/ui/status-pill"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorMessage } from "@/components/ui/error-message"
import { useIsAdminState } from "@/hooks/use-is-admin"
import { useSubvenciones } from "@/hooks/use-subvenciones"
import { SubvencionFormDialog } from "./subvencion-form-dialog"
import { SUBVENCION_ESTADO_INFO, porcentajeImputado } from "@/lib/utils/subvenciones"
import { formatCurrency } from "@/lib/utils/format"
import { describirError } from "@/lib/utils/describir-error"
import type { SubvencionConResumen, SubvencionEstado } from "@/lib/types/database"

type Pestana = "en_curso" | "terminadas" | "denegadas" | "todas"

const PESTANAS: Record<Pestana, { label: string; estados: SubvencionEstado[] | null }> = {
  en_curso: { label: "En curso", estados: ["en_preparacion", "solicitada", "concedida"] },
  terminadas: { label: "Justificadas y cerradas", estados: ["justificada", "cerrada"] },
  denegadas: { label: "Denegadas", estados: ["denegada"] },
  todas: { label: "Todas", estados: null },
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function SubvencionesManager() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useIsAdminState()
  const { subvenciones, loading, error, invalidar } = useSubvenciones({ enabled: isAdmin })
  const [pestana, setPestana] = useState<Pestana>("en_curso")
  const [busqueda, setBusqueda] = useState("")
  const [crearOpen, setCrearOpen] = useState(false)

  const cuentas = useMemo(() => {
    const out = {} as Record<Pestana, number>
    for (const p of Object.keys(PESTANAS) as Pestana[]) {
      const estados = PESTANAS[p].estados
      out[p] = estados ? subvenciones.filter((s) => estados.includes(s.estado)).length : subvenciones.length
    }
    return out
  }, [subvenciones])

  const visibles = useMemo(() => {
    const estados = PESTANAS[pestana].estados
    const q = normalizar(busqueda.trim())
    return subvenciones.filter((s) => {
      if (estados && !estados.includes(s.estado)) return false
      if (!q) return true
      return normalizar(
        [s.nombre, s.financiador, s.convocatoria, s.expediente, s.ejercicio].filter(Boolean).join(" "),
      ).includes(q)
    })
  }, [subvenciones, pestana, busqueda])

  if (adminLoading) return <PageSkeleton />
  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Landmark className="h-5 w-5" />}
        title="Solo para la oficina técnica"
        description="Las subvenciones las gestionan los gestores centrales. Si necesitas verlas, pídeselo a la oficina técnica."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subvenciones"
        actions={
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva subvención
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          value={pestana}
          onValueChange={(v) => setPestana(v as Pestana)}
          items={(Object.keys(PESTANAS) as Pestana[]).map((p) => ({
            value: p,
            label: PESTANAS[p].label,
            count: cuentas[p],
          }))}
        />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, financiador, expediente…"
            className="pl-8"
            aria-label="Buscar subvenciones"
          />
        </div>
      </div>

      {error ? (
        <ErrorMessage message={describirError(error, "No se han podido cargar las subvenciones")} />
      ) : loading ? (
        <PageSkeleton rows={5} tabs={0} />
      ) : subvenciones.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-5 w-5" />}
          title="Aún no hay subvenciones"
          description="Crea la primera y después, desde Movimientos, selecciona los gastos de cualquier delegación y asígnalos a ella."
        >
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva subvención
          </Button>
        </EmptyState>
      ) : visibles.length === 0 ? (
        <EmptyState
          title="Ninguna subvención coincide"
          description={busqueda ? `Nada con «${busqueda}» en «${PESTANAS[pestana].label}».` : `No hay ninguna en «${PESTANAS[pestana].label}».`}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {busqueda && (
              <Button variant="outline" onClick={() => setBusqueda("")}>
                Quitar la búsqueda
              </Button>
            )}
            {pestana !== "todas" && (
              <Button variant="outline" onClick={() => setPestana("todas")}>
                Ver todas ({cuentas.todas})
              </Button>
            )}
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-2" aria-live="polite">
          {visibles.map((s) => (
            <SubvencionRow key={s.id} subvencion={s} onOpen={() => router.push(`/subvenciones/${s.id}`)} />
          ))}
        </div>
      )}

      <SubvencionFormDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        onSaved={(s) => {
          invalidar()
          router.push(`/subvenciones/${s.id}`)
        }}
      />
    </div>
  )
}

function SubvencionRow({ subvencion: s, onOpen }: { subvencion: SubvencionConResumen; onOpen: () => void }) {
  const info = SUBVENCION_ESTADO_INFO[s.estado]
  const pct = porcentajeImputado(s.resumen.total_gastos, s.importe_concedido)
  const detalle = [s.financiador, s.ejercicio, s.expediente].filter(Boolean).join(" · ")

  return (
    <ListRow onClick={onOpen}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">{s.nombre}</span>
            <StatusPill
              label={info.label}
              icon={info.icon}
              bgClass={info.bgClass}
              textClass={info.textClass}
              borderClass={info.borderClass}
            />
          </div>
          <p className="truncate text-xs text-muted-foreground">{detalle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-6 text-right text-sm tabular-nums">
          <div>
            <div className="text-xs text-muted-foreground">Concedido</div>
            <div className="font-medium">{s.importe_concedido != null ? formatCurrency(s.importe_concedido) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Imputado</div>
            <div className="font-medium">
              {formatCurrency(s.resumen.total_gastos)}
              {pct != null && <span className="ml-1 text-xs text-muted-foreground">({pct.toLocaleString("es-ES")} %)</span>}
            </div>
          </div>
          <div className="min-w-[5.5rem]">
            <div className="text-xs text-muted-foreground">Movimientos</div>
            <div className="font-medium">
              {s.resumen.movimientos}
              {s.resumen.delegaciones > 1 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">en {s.resumen.delegaciones} deleg.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </ListRow>
  )
}
