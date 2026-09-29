"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Check, Landmark, Plus, Repeat, Search } from "lucide-react"
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
import {
  SUBVENCION_ESTADO_INFO,
  agruparPorAmbito,
  importeCobrado,
  proximaFecha,
  totalesEjercicio,
} from "@/lib/utils/subvenciones"
import { formatCurrency, formatDate, toLocalDateString } from "@/lib/utils/format"
import { describirError } from "@/lib/utils/describir-error"
import { cn } from "@/lib/utils"
import type { SubvencionConResumen } from "@/lib/types/database"

/**
 * Una pestaña por ejercicio, y "Para estudiar" (sin ejercicio) solo si hay
 * alguna. Nunca todos los años juntos: se trabaja año a año, como en el Excel,
 * y mezclarlos haría que los totales no significaran nada.
 */
const PARA_ESTUDIAR = "estudiar"

function enPestana(s: SubvencionConResumen, p: string) {
  return p === PARA_ESTUDIAR ? s.ejercicio == null : String(s.ejercicio) === p
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function coincide(s: SubvencionConResumen, q: string) {
  if (!q) return true
  return normalizar(
    [s.codigo, s.nombre, s.financiador?.nombre, s.solicitante, s.convocatoria, s.expediente, s.notas]
      .filter(Boolean)
      .join(" "),
  ).includes(q)
}

export function SubvencionesManager() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useIsAdminState()
  const { subvenciones, loading, error, invalidar } = useSubvenciones({ enabled: isAdmin })
  const [pestanaElegida, setPestana] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [crearOpen, setCrearOpen] = useState(false)

  // Como el Excel: un bloque por año, el más reciente primero.
  const ejercicios = useMemo(
    () => [...new Set(subvenciones.map((s) => s.ejercicio).filter((e): e is number => e != null))].sort((a, b) => b - a),
    [subvenciones],
  )
  const hayParaEstudiar = subvenciones.some((s) => s.ejercicio == null)
  const anioActual = new Date().getFullYear()
  const pestanaPorDefecto = ejercicios.includes(anioActual)
    ? String(anioActual)
    : ejercicios[0]
      ? String(ejercicios[0])
      : hayParaEstudiar
        ? PARA_ESTUDIAR
        : String(anioActual)
  const pestana = pestanaElegida ?? pestanaPorDefecto

  const q = normalizar(busqueda.trim())
  const visibles = useMemo(
    () => subvenciones.filter((s) => enPestana(s, pestana) && coincide(s, q)),
    [subvenciones, pestana, q],
  )
  // Si se busca algo que está en otro año, se dice dónde, sin mezclar años.
  const enOtrosAnios = useMemo(() => {
    if (!q) return []
    const cuenta = new Map<string, number>()
    for (const s of subvenciones) {
      const p = s.ejercicio == null ? PARA_ESTUDIAR : String(s.ejercicio)
      if (p !== pestana && coincide(s, q)) cuenta.set(p, (cuenta.get(p) ?? 0) + 1)
    }
    return [...cuenta.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [subvenciones, pestana, q])

  const grupos = useMemo(() => agruparPorAmbito(visibles), [visibles])
  const totales = useMemo(() => totalesEjercicio(visibles), [visibles])
  const hoy = toLocalDateString(new Date())

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

  const tabs = [
    ...ejercicios.map((e) => ({
      value: String(e),
      label: String(e),
      count: subvenciones.filter((s) => s.ejercicio === e).length,
    })),
    ...(hayParaEstudiar
      ? [{ value: PARA_ESTUDIAR, label: "Para estudiar", count: subvenciones.filter((s) => s.ejercicio == null).length }]
      : []),
  ]
  const etiquetaPestana = tabs.find((t) => t.value === pestana)?.label ?? ""
  const esAnio = /^\d{4}$/.test(pestana)

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
        <FilterTabs value={pestana} onValueChange={setPestana} items={tabs} />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, financiador, nombre…"
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
          description="Crea la primera y después, desde Movimientos, selecciona los gastos de cualquier delegación e imputáselos."
        >
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva subvención
          </Button>
        </EmptyState>
      ) : (
        <>
          {pestana !== PARA_ESTUDIAR && visibles.length > 0 && (
            <dl
              className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4"
              aria-label={`Totales de ${etiquetaPestana}`}
            >
              <Total label="Máximo posible" valor={totales.solicitado} ayuda="Lo solicitado en lo que sigue vivo" />
              <Total label={esAnio ? `Confirmado ${pestana}` : "Confirmado"} valor={totales.confirmado} destacado />
              <Total label="Cobrado" valor={totales.cobrado} />
              <Total label="Por cobrar" valor={totales.porCobrar} />
            </dl>
          )}

          {visibles.length === 0 ? (
            <EmptyState
              title="Ninguna subvención coincide"
              description={busqueda ? `Nada con «${busqueda}» en «${etiquetaPestana}».` : `No hay ninguna en «${etiquetaPestana}».`}
            >
              <div className="flex flex-wrap justify-center gap-2">
                {busqueda && (
                  <Button variant="outline" onClick={() => setBusqueda("")}>
                    Quitar la búsqueda
                  </Button>
                )}
                {enOtrosAnios.map(([p, n]) => (
                  <Button key={p} variant="outline" onClick={() => setPestana(p)}>
                    {n} en {p === PARA_ESTUDIAR ? "Para estudiar" : p}
                  </Button>
                ))}
              </div>
            </EmptyState>
          ) : (
            <div className="space-y-6" aria-live="polite">
              {grupos.map((g) => (
                <section key={g.ambito} aria-labelledby={`grupo-${g.ambito}`} className="space-y-2">
                  <h2
                    id={`grupo-${g.ambito}`}
                    className="flex items-baseline gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {g.label}
                    <span className="font-normal normal-case tracking-normal">{g.subvenciones.length}</span>
                  </h2>
                  {g.subvenciones.map((s) => (
                    <SubvencionRow
                      key={s.id}
                      subvencion={s}
                      hoy={hoy}
                      onOpen={() => router.push(`/subvenciones/${s.id}`)}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <SubvencionFormDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        plantilla={esAnio ? { ejercicio: Number(pestana) } : pestana === PARA_ESTUDIAR ? { ejercicio: null } : null}
        onSaved={(s) => {
          invalidar()
          router.push(`/subvenciones/${s.id}`)
        }}
      />
    </div>
  )
}

function Total({ label, valor, ayuda, destacado }: { label: string; valor: number; ayuda?: string; destacado?: boolean }) {
  return (
    <div className="bg-card px-4 py-3" title={ayuda}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-base font-semibold tabular-nums", destacado && "text-primary")}>{formatCurrency(valor)}</dd>
    </div>
  )
}

function SubvencionRow({
  subvencion: s,
  hoy,
  onOpen,
}: {
  subvencion: SubvencionConResumen
  hoy: string
  onOpen: () => void
}) {
  const info = SUBVENCION_ESTADO_INFO[s.estado]
  const descartada = info.fase === "descartada"
  const fecha = proximaFecha(s, hoy)
  const cobrado = importeCobrado(s)
  const principal = s.importe_concedido ?? s.importe_solicitado
  const detalle = [s.financiador?.nombre, s.solicitante].filter(Boolean).join(" · ")

  return (
    <ListRow onClick={onOpen} className={cn(descartada && "opacity-70")}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {s.codigo && (
              <span className="shrink-0 rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80">
                {s.codigo}
              </span>
            )}
            <span className="min-w-0 truncate font-medium text-foreground">{s.nombre}</span>
            {s.recurrente && <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sale cada año" />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{detalle}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 sm:flex-nowrap sm:justify-end">
          <div className="flex items-center gap-1.5">
            <StatusPill
              label={info.label}
              icon={info.icon}
              bgClass={info.bgClass}
              textClass={info.textClass}
              borderClass={info.borderClass}
            />
            {s.justificacion_completa && (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Justificación completa" />
            )}
          </div>

          <div className="w-32 text-xs text-muted-foreground">
            {fecha ? (
              <span className="inline-flex items-center gap-1" title={fecha.etiqueta}>
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {fecha.etiqueta.split(" ")[0]} {formatDate(fecha.fecha)}
                </span>
              </span>
            ) : null}
          </div>

          <div className="w-28 text-right tabular-nums">
            <div className="text-[11px] text-muted-foreground">
              {s.importe_concedido != null ? "Concedido" : s.importe_solicitado != null ? "Solicitado" : " "}
            </div>
            <div className={cn("text-sm font-medium", s.importe_concedido == null && "text-muted-foreground")}>
              {principal != null ? formatCurrency(principal) : "—"}
            </div>
          </div>

          <div className="w-28 text-right tabular-nums">
            <div className="text-[11px] text-muted-foreground">
              {s.resumen.movimientos > 0 ? `Imputado · ${s.resumen.movimientos} mov.` : cobrado > 0 ? "Cobrado" : " "}
            </div>
            <div className="text-sm font-medium">
              {s.resumen.movimientos > 0
                ? formatCurrency(s.resumen.total_gastos)
                : cobrado > 0
                  ? formatCurrency(cobrado)
                  : ""}
            </div>
          </div>
        </div>
      </div>
    </ListRow>
  )
}
