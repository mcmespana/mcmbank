"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PartyPopper,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DatabaseService, type MovimientoVinculadoSimilar } from "@/lib/services/database"
import { useDebouncedState } from "@/hooks/use-debounced-state"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { esMatchDirecto, scoreCandidatoMovimiento } from "@/lib/utils/facturas"
import type { MovimientoConRelaciones } from "@/lib/types/database"

/** Movimientos por página al buscar a mano. */
const POR_PAGINA = 10

interface FacturaConciliacionPanelProps {
  delegacionId: string
  /** Id de la factura abierta (para no señalarse a sí misma como duplicada). */
  facturaId?: string | null
  /** Importe que aún le falta cubrir a la factura (total menos lo ya vinculado). */
  importePendiente: number | null
  /** Suma de los movimientos ya vinculados (0 si aún no tiene ninguno). */
  importeYaPagado: number
  fechaEmision: string | null
  contactoId: string | null
  /** Nombre del proveedor, para cotejarlo con el concepto del movimiento. */
  contactoNombre?: string | null
  seleccion: string | null
  onSeleccionChange: (id: string | null) => void
  /** Avisa de que se está buscando a mano, para dar más ancho al panel. */
  onModoBusquedaChange?: (buscando: boolean) => void
}

/**
 * Cuerpo de la búsqueda de candidatos para conciliar una factura, extraído
 * de vincular-movimiento-dialog.tsx para poder vivir tanto en ese diálogo
 * como, embebido, en el panel de la factura — donde se recalcula al vuelo
 * cada vez que se edita el importe en la sección de datos.
 *
 * Tiene tres capas, de más automática a más manual:
 *
 * 1. **El aviso de duplicada**: un movimiento que cuadra clavado pero que ya
 *    tiene otra factura. No se puede vincular, y casi siempre significa que
 *    esta factura ya estaba metida y esto es el mismo papel por segunda vez.
 * 2. **Las sugerencias**: los gastos sin factura que pegan por importe, fecha
 *    y proveedor, ordenados por afinidad.
 * 3. **La búsqueda a mano**: la lista de movimientos de la delegación, de diez
 *    en diez desde la fecha de la factura, navegable hacia atrás y hacia
 *    delante y filtrable por texto. Se usa poco, pero cuando el extracto trae
 *    la compra con otro importe (un redondeo, un envío) es la única salida.
 */
export function FacturaConciliacionPanel({
  delegacionId,
  facturaId,
  importePendiente,
  importeYaPagado,
  fechaEmision,
  contactoId,
  contactoNombre,
  seleccion,
  onSeleccionChange,
  onModoBusquedaChange,
}: FacturaConciliacionPanelProps) {
  const [candidatos, setCandidatos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [duplicados, setDuplicados] = useState<MovimientoVinculadoSimilar[]>([])
  const [buscando, setBuscando] = useState(false)

  // Buscar a mano pide ancho: el panel se lo pide al workspace.
  useEffect(() => {
    onModoBusquedaChange?.(buscando)
  }, [buscando, onModoBusquedaChange])

  const facturaParaScore = useMemo(
    () => ({
      id: facturaId ?? null,
      importe: importePendiente,
      fecha_emision: fechaEmision,
      contacto_id: contactoId,
      contacto_nombre: contactoNombre ?? null,
    }),
    [facturaId, importePendiente, fechaEmision, contactoId, contactoNombre],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    DatabaseService.findCandidatosMovimientoParaFactura(delegacionId, facturaParaScore, { limit: 30 })
      .then((list) => {
        if (!cancelled) setCandidatos(list)
      })
      .catch(() => {
        if (!cancelled) setCandidatos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [delegacionId, facturaParaScore])

  // Movimientos que pegarían pero ya tienen factura: el aviso de duplicada.
  useEffect(() => {
    let cancelled = false
    DatabaseService.findMovimientosVinculadosSimilares(delegacionId, facturaParaScore, { limit: 5 })
      .then((list) => {
        if (!cancelled) setDuplicados(list)
      })
      .catch(() => {
        if (!cancelled) setDuplicados([])
      })
    return () => {
      cancelled = true
    }
  }, [delegacionId, facturaParaScore])

  const scores = useMemo(
    () => candidatos.map((m) => scoreCandidatoMovimiento(facturaParaScore, m)),
    [candidatos, facturaParaScore],
  )

  const matchDirecto = useMemo(() => esMatchDirecto(scores), [scores])

  // Pre-selecciona el match directo para minimizar clicks.
  useEffect(() => {
    if (matchDirecto && candidatos[0] && !seleccion) {
      onSeleccionChange(candidatos[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDirecto, candidatos])

  return (
    <div className="space-y-2">
      {duplicados.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-rose-300/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="flex items-start gap-1.5 text-xs font-medium text-rose-800 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {duplicados.length === 1
                ? "Hay un movimiento que cuadra clavado, pero ya tiene factura."
                : "Hay movimientos que cuadran clavados, pero ya tienen factura."}{" "}
              ¿Es esta factura un duplicado? Si lo es, bórrala desde el menú de abajo.
            </span>
          </p>
          {duplicados.map((m) => (
            <div
              key={m.id}
              className="rounded-md bg-background/70 px-2 py-1 text-[11px] text-rose-900 dark:bg-background/30 dark:text-rose-200"
            >
              <span className="font-medium">
                {formatDate(m.fecha)} · {formatCurrency(Number(m.importe))}
              </span>{" "}
              · {m.concepto}
              {m.factura && (
                <span className="block text-rose-700/80 dark:text-rose-300/80">
                  Ya vinculado a: {m.factura.concepto?.trim() || m.factura.numero || "otra factura"}
                  {m.factura.fecha_emision ? ` (${formatDate(m.factura.fecha_emision)})` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {importeYaPagado > 0 && importePendiente != null && (
        <p className="rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
          Ya hay {formatCurrency(importeYaPagado)} vinculados. Buscando movimientos por el resto:{" "}
          <span className="font-semibold">{formatCurrency(importePendiente)}</span>.
        </p>
      )}

      {matchDirecto && candidatos[0] ? (
        <p className="flex items-start gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Fijo que es este. Mismo importe y por las mismas fechas: ya te lo he marcado, tú solo
            guarda.
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {importePendiente != null
            ? "Gastos con un importe parecido (con un pelín de margen) sin factura vinculada, ordenados por afinidad."
            : "Últimos gastos sin factura vinculada. Añade el importe a la factura para afinar la búsqueda."}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos…
        </div>
      ) : candidatos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          No hay movimientos candidatos. Puede que aún no se haya importado del banco, que se pagara
          fuera de MCM Bank, o que el importe del banco no sea exactamente el de la factura: búscalo a
          mano aquí abajo.
        </div>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {candidatos.map((m, idx) => (
            <MovimientoCandidato
              key={m.id}
              movimiento={m}
              score={scores[idx]}
              esTop={idx === 0 && matchDirecto}
              seleccionado={seleccion === m.id}
              onToggle={() => onSeleccionChange(seleccion === m.id ? null : m.id)}
            />
          ))}
        </div>
      )}

      {/* El buscador solo existe mientras se usa: montarlo es lo que dispara su
          primera búsqueda, y desmontarlo tira el estado sin tener que limpiarlo. */}
      {buscando ? (
        <BuscadorMovimientos
          delegacionId={delegacionId}
          fechaEmision={fechaEmision}
          seleccion={seleccion}
          onSeleccionChange={onSeleccionChange}
          onCerrar={() => setBuscando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setBuscando(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Buscar otro movimiento
        </button>
      )}
    </div>
  )
}

/** Una fila de movimiento seleccionable, con sus insignias de por qué encaja. */
function MovimientoCandidato({
  movimiento,
  score,
  esTop,
  seleccionado,
  onToggle,
}: {
  movimiento: MovimientoConRelaciones
  score?: ReturnType<typeof scoreCandidatoMovimiento>
  esTop?: boolean
  seleccionado: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full rounded-lg border p-2.5 text-left text-sm transition-colors",
        seleccionado
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{movimiento.concepto}</span>
        <span className="font-mono text-xs text-rose-700 dark:text-rose-400">
          {formatCurrency(Number(movimiento.importe))}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>{formatDate(movimiento.fecha)}</span>
        {movimiento.cuenta?.nombre && <span>· {movimiento.cuenta.nombre}</span>}
        {esTop && (
          <Etiqueta tono="primary">
            <Sparkles className="h-3 w-3" /> Este es
          </Etiqueta>
        )}
        {score?.importeExacto && !esTop && <Etiqueta tono="emerald">importe exacto</Etiqueta>}
        {score?.fechaCercana && <Etiqueta tono="sky">fecha cercana</Etiqueta>}
        {score?.mismoContacto && <Etiqueta tono="violet">mismo contacto</Etiqueta>}
        {score?.nombreEnConcepto && <Etiqueta tono="emerald">lo nombra el concepto</Etiqueta>}
        {score?.otroProveedorEnConcepto && <Etiqueta tono="rose">es de otro proveedor</Etiqueta>}
      </div>
    </button>
  )
}

function Etiqueta({
  children,
  tono,
}: {
  children: React.ReactNode
  tono: "primary" | "emerald" | "sky" | "violet" | "rose"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        tono === "primary" && "bg-primary/10 font-semibold text-primary",
        tono === "emerald" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        tono === "sky" && "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
        tono === "violet" && "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
        tono === "rose" && "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
      )}
    >
      {children}
    </span>
  )
}

/**
 * Buscar a mano entre los movimientos de la delegación.
 *
 * La navegación es una sola idea: una "página" de diez movimientos, anclada en
 * la fecha de la factura. `pagina` 0 son los diez anteriores a esa fecha (que
 * es donde va a estar casi siempre el pago), los positivos siguen hacia atrás
 * en el tiempo y los negativos hacia delante. Con texto escrito el ancla pasa a
 * ser hoy: si estás buscando por nombre no quieres que la fecha te limite.
 */
function BuscadorMovimientos({
  delegacionId,
  fechaEmision,
  seleccion,
  onSeleccionChange,
  onCerrar,
}: {
  delegacionId: string
  fechaEmision: string | null
  seleccion: string | null
  onSeleccionChange: (id: string | null) => void
  onCerrar: () => void
}) {
  const [pagina, setPagina] = useState(0)
  const { value: textoDebounced, immediateValue: texto, setValue: setTexto } = useDebouncedState("", 250)
  // La página cargada se guarda junto a la clave que la pidió: así "cargando"
  // es sencillamente "todavía no hay respuesta para lo que se está pidiendo",
  // sin un segundo estado que haya que poner y quitar a mano.
  const [resultado, setResultado] = useState<{ clave: string; lista: MovimientoConRelaciones[] } | null>(null)

  const buscandoPorTexto = Boolean(textoDebounced.trim())
  const ancla = buscandoPorTexto ? null : fechaEmision
  const clave = `${ancla ?? "hoy"}|${pagina}|${textoDebounced}`
  const cargando = resultado?.clave !== clave
  const movimientos = resultado?.clave === clave ? resultado.lista : []

  useEffect(() => {
    let cancelado = false
    const direccion = pagina >= 0 ? "antes" : "despues"
    const offset = (pagina >= 0 ? pagina : -pagina - 1) * POR_PAGINA
    DatabaseService.buscarMovimientosParaVincular(delegacionId, {
      ancla,
      direccion,
      offset,
      limit: POR_PAGINA,
      texto: textoDebounced || null,
    })
      .then((list) => {
        if (cancelado) return
        // Siempre de más reciente a más antiguo, vaya la página hacia donde vaya:
        // la lista se lee igual en los dos sentidos.
        const lista = [...list].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
        setResultado({ clave, lista })
      })
      .catch(() => {
        if (!cancelado) setResultado({ clave, lista: [] })
      })
    return () => {
      cancelado = true
    }
  }, [clave, delegacionId, ancla, pagina, textoDebounced])

  const sinResultados = !cargando && movimientos.length === 0

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={texto}
            // Escribir vuelve a la primera página: seguir en "la página 3" de
            // una lista que acaba de cambiar entera no significa nada.
            onChange={(e) => {
              setTexto(e.target.value)
              setPagina(0)
            }}
            placeholder="Filtrar por concepto…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la búsqueda"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {buscandoPorTexto
          ? "Gastos sin factura de toda la delegación, de más reciente a más antiguo."
          : fechaEmision
            ? `Gastos sin factura alrededor del ${formatDate(fechaEmision)}. Usa las flechas para ir antes o después.`
            : "Gastos sin factura, de más reciente a más antiguo."}
      </p>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
        </div>
      ) : sinResultados ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          Nada por aquí. Prueba con otras fechas o con otro texto.
        </p>
      ) : (
        <div className="space-y-1.5">
          {movimientos.map((m) => (
            <MovimientoCandidato
              key={m.id}
              movimiento={m}
              seleccionado={seleccion === m.id}
              onToggle={() => onSeleccionChange(seleccion === m.id ? null : m.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {/* Con texto escrito el ancla es hoy, así que "más recientes" que la
            primera página no existe: no hay gastos con fecha futura. */}
        <BotonPagina
          onClick={() => setPagina((p) => p - 1)}
          disabled={cargando || (buscandoPorTexto && pagina <= 0)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Más recientes
        </BotonPagina>
        <span className="text-[11px] text-muted-foreground">
          {buscandoPorTexto
            ? `Página ${pagina + 1}`
            : pagina === 0
              ? "Justo antes de la factura"
              : pagina > 0
                ? `${pagina * POR_PAGINA} movimientos antes`
                : `${-pagina * POR_PAGINA} movimientos después`}
        </span>
        <BotonPagina
          onClick={() => setPagina((p) => p + 1)}
          disabled={cargando || (buscandoPorTexto && movimientos.length < POR_PAGINA)}
        >
          Más antiguos <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </BotonPagina>
      </div>
    </div>
  )
}

function BotonPagina({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  )
}
