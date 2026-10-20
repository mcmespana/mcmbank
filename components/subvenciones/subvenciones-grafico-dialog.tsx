"use client"

import { useMemo, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FilterTabs } from "@/components/ui/filter-tabs"
import {
  claveFinanciador,
  porcionesPorEstado,
  porcionesPorFinanciador,
  type PorcionResumen,
} from "@/lib/utils/subvenciones"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SubvencionConResumen, SubvencionEstado } from "@/lib/types/database"

type Vista = "financiador" | "estado"
type Medida = "n" | "importe" | "solicitado" | "confirmado"

const MEDIDA_INFO: Record<Medida, { label: string; centro: string }> = {
  n: { label: "Cuántas", centro: "subvenciones" },
  importe: { label: "En juego", centro: "en juego" },
  solicitado: { label: "Solicitado", centro: "solicitado" },
  confirmado: { label: "Confirmado", centro: "confirmado" },
}

/**
 * Un financiador se mide en euros (contar subvenciones pondría un IVAJ de
 * 67.000 € al lado de una de 2.000 como si fueran iguales); un estado, en
 * número, que es lo que se pregunta de él. La primera de cada lista es la
 * que sale al abrir.
 */
const MEDIDAS: Record<Vista, Medida[]> = {
  financiador: ["importe", "confirmado", "solicitado"],
  estado: ["n", "importe", "confirmado", "solicitado"],
}

/**
 * El año en un gráfico circular, por financiador o por estado, contando
 * subvenciones o euros. Es otra forma de filtrar la misma lista: pulsar un
 * trozo (o su fila) hace lo mismo que pulsar la pastilla del resumen, y la
 * lista de detrás cambia a la vez.
 *
 * Lo que se reparte es lo que deja pasar el *otro* filtro: con "Concedida"
 * elegido, el gráfico por financiador enseña quién paga las concedidas. El
 * filtro de la vista que se está mirando no recorta el gráfico, lo resalta: si
 * no, al elegir un trozo los demás desaparecerían y no habría con qué
 * compararlo.
 */
export function SubvencionesGraficoDialog({
  open,
  onOpenChange,
  etiqueta,
  subvenciones,
  colores,
  conDinero,
  estados,
  financiadores,
  visibles,
  onAlternarEstado,
  onAlternarFinanciador,
  onQuitarFiltros,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  etiqueta: string
  subvenciones: SubvencionConResumen[]
  colores: Map<string, string>
  conDinero: boolean
  estados: Set<SubvencionEstado>
  financiadores: Set<string>
  /** Cuántas quedan en la lista con los filtros (y la búsqueda) de ahora. */
  visibles: number
  onAlternarEstado: (e: SubvencionEstado) => void
  onAlternarFinanciador: (f: string) => void
  onQuitarFiltros: () => void
}) {
  const [vista, setVista] = useState<Vista>("financiador")
  const [medidas, setMedidas] = useState<Record<Vista, Medida>>({ financiador: "importe", estado: "n" })
  const [encima, setEncima] = useState<string | null>(null)
  // "Para estudiar" no tiene importes que repartir.
  const medida = conDinero ? medidas[vista] : "n"

  const activos: Set<string> = vista === "estado" ? estados : financiadores
  const alternar = (clave: string) =>
    vista === "estado" ? onAlternarEstado(clave as SubvencionEstado) : onAlternarFinanciador(clave)

  const porciones = useMemo(() => {
    const repartir = (ss: SubvencionConResumen[]) =>
      vista === "estado" ? porcionesPorEstado(ss) : porcionesPorFinanciador(ss, colores)
    const base =
      vista === "estado"
        ? subvenciones.filter((s) => financiadores.size === 0 || financiadores.has(claveFinanciador(s)))
        : subvenciones.filter((s) => estados.size === 0 || estados.has(s.estado))
    const conBase = new Map(repartir(base).map((p) => [p.clave, p]))
    // Lo elegido se queda en la leyenda aunque el otro filtro lo deje a cero:
    // si no, no habría desde dónde quitarlo.
    return repartir(subvenciones)
      .filter((p) => conBase.has(p.clave) || activos.has(p.clave))
      .map((p) => conBase.get(p.clave) ?? { ...p, n: 0, solicitado: 0, confirmado: 0, importe: 0 })
  }, [vista, subvenciones, estados, financiadores, colores, activos])

  const valor = (p: PorcionResumen) => p[medida]
  const conValor = porciones.filter((p) => valor(p) > 0)
  const total = porciones.reduce((t, p) => t + valor(p), 0)
  const formato = (n: number) => (medida === "n" ? String(n) : formatCurrency(n))
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const hayActivos = activos.size > 0
  const apagado = (p: PorcionResumen) => hayActivos && !activos.has(p.clave)
  const filtrando = estados.size > 0 || financiadores.size > 0

  // El centro del donut: lo que hay debajo del ratón, o lo elegido, o el total.
  const sobre = encima ? porciones.find((p) => p.clave === encima) : undefined
  const elegidas = porciones.filter((p) => activos.has(p.clave))
  const centro = sobre
    ? { cifra: formato(valor(sobre)), texto: sobre.label, pie: `${pct(valor(sobre))} %` }
    : elegidas.length
      ? {
          cifra: formato(elegidas.reduce((t, p) => t + valor(p), 0)),
          texto: `de ${formato(total)}`,
          pie: elegidas.length === 1 ? elegidas[0].label : `${elegidas.length} elegidos`,
        }
      : { cifra: formato(total), texto: MEDIDA_INFO[medida].centro, pie: etiqueta }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-5">
        <DialogHeader>
          <DialogTitle>Subvenciones {etiqueta}</DialogTitle>
          <DialogDescription>
            Pulsa un trozo o una fila para ver solo esas. Se combina con lo que elijas en la otra vista.
            {medida === "importe" && " «En juego» es lo concedido si ya está confirmada y, si no, lo solicitado; las rechazadas y las renuncias no cuentan."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterTabs
            value={vista}
            onValueChange={(v) => {
              setVista(v as Vista)
              setEncima(null)
            }}
            items={[
              { value: "financiador", label: "Por financiador", count: financiadores.size || undefined },
              { value: "estado", label: "Por estado", count: estados.size || undefined },
            ]}
          />
          {conDinero && (
            <FilterTabs
              value={medida}
              onValueChange={(v) => setMedidas((m) => ({ ...m, [vista]: v as Medida }))}
              items={MEDIDAS[vista].map((value) => ({ value, label: MEDIDA_INFO[value].label }))}
            />
          )}
        </div>

        {conValor.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {medida === "n" ? "No hay subvenciones con estos filtros." : `Ninguna tiene importe ${MEDIDA_INFO[medida].centro}.`}
          </p>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[16rem_minmax(0,1fr)]">
            <div
              className="relative mx-auto aspect-square w-full max-w-[16rem] [&_.recharts-pie-sector]:cursor-pointer [&_.recharts-sector]:outline-none [&_svg]:outline-none"
              role="img"
              aria-label={`${vista === "estado" ? "Por estado" : "Por financiador"}: ${conValor
                .map((p) => `${p.label} ${formato(valor(p))}`)
                .join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conValor.map((p) => ({ name: p.label, value: valor(p), clave: p.clave }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="96%"
                    paddingAngle={conValor.length > 1 ? 1.5 : 0}
                    cornerRadius={4}
                    startAngle={90}
                    endAngle={-270}
                    stroke="oklch(var(--background))"
                    strokeWidth={2}
                    animationDuration={450}
                    onClick={(_: unknown, i: number) => alternar(conValor[i].clave)}
                    onMouseEnter={(_: unknown, i: number) => setEncima(conValor[i].clave)}
                    onMouseLeave={() => setEncima(null)}
                  >
                    {conValor.map((p) => (
                      <Cell
                        key={p.clave}
                        fill={p.color}
                        style={{ transition: "opacity 150ms ease-out" }}
                        opacity={apagado(p) && encima !== p.clave ? 0.22 : encima && encima !== p.clave ? 0.7 : 1}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center" aria-hidden>
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{centro.cifra}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{centro.texto}</span>
                <span className="mt-0.5 line-clamp-1 text-[11px] font-medium text-muted-foreground/80">{centro.pie}</span>
              </div>
            </div>

            <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto pr-1" aria-label="Leyenda: pulsa para filtrar">
              {porciones.map((p) => {
                const activo = activos.has(p.clave)
                const v = valor(p)
                return (
                  <li key={p.clave}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      onClick={() => alternar(p.clave)}
                      onMouseEnter={() => setEncima(p.clave)}
                      onMouseLeave={() => setEncima(null)}
                      onFocus={() => setEncima(p.clave)}
                      onBlur={() => setEncima(null)}
                      className={cn(
                        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activo ? "bg-muted" : "hover:bg-muted/60",
                        apagado(p) && "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full transition-opacity", apagado(p) && "opacity-40")}
                        style={{ backgroundColor: p.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium">
                        {p.label}
                        {medida !== "n" && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">· {p.n}</span>}
                      </span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        <span className={cn(v === 0 && "text-muted-foreground")}>{v > 0 ? formato(v) : "—"}</span>
                        <span className="w-9 text-right text-xs text-muted-foreground">{v > 0 ? `${pct(v)} %` : ""}</span>
                      </span>
                      <span className="col-span-2 col-start-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span
                          className={cn("block h-full rounded-full transition-[width,opacity] duration-300 ease-out", apagado(p) && "opacity-40")}
                          style={{ width: `${total > 0 ? (v / total) * 100 : 0}%`, backgroundColor: p.color }}
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:items-center">
          {filtrando && (
            <Button variant="ghost" onClick={onQuitarFiltros} className="sm:mr-auto">
              <X className="h-4 w-4" />
              Quitar filtros
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Ver {visibles} {visibles === 1 ? "subvención" : "subvenciones"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
