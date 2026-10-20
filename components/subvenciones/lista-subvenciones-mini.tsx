import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { CodigoSubvencion } from "./codigo-subvencion"
import { SUBVENCION_ESTADO_INFO, importeDeFila } from "@/lib/utils/subvenciones"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SubvencionConResumen } from "@/lib/types/database"

/**
 * Lo que sale al pasar por encima de un trozo de barra, una pastilla o una
 * porción del gráfico: cuáles son, no solo cuántas. "1 Renunciamos" no dice
 * nada hasta que se ve que es Ayto CS Cul.
 */
export function ListaSubvencionesMini({
  titulo,
  color,
  resumen,
  subvenciones,
  pie,
  max = 8,
}: {
  titulo: string
  color: string
  resumen?: ReactNode
  subvenciones: SubvencionConResumen[]
  /** Lo que pasa al pulsar ("Pulsa para ver solo esas"). */
  pie?: string
  max?: number
}) {
  const vistas = subvenciones.slice(0, max)
  const resto = subvenciones.length - vistas.length

  return (
    <div className="w-72 space-y-2 py-0.5">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="min-w-0 truncate">{titulo}</span>
        </p>
        {resumen && <p className="text-xs text-muted-foreground">{resumen}</p>}
      </div>
      {vistas.length > 0 && (
        <ul className="space-y-1 border-t pt-2">
          {vistas.map((s) => (
            <li key={s.id} className="flex min-w-0 items-center gap-1.5 text-xs">
              <EstadoPunto s={s} />
              {s.codigo && <CodigoSubvencion codigo={s.codigo} nombre={s.nombre} color={s.color} className="text-[10px]" />}
              <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
              <ImporteFila s={s} corto />
            </li>
          ))}
          {resto > 0 && <li className="text-xs text-muted-foreground">y {resto} más</li>}
        </ul>
      )}
      {pie && <p className="text-[11px] text-muted-foreground">{pie}</p>}
    </div>
  )
}

/**
 * Una subvención en una lista que se pulsa para abrirla en la hoja lateral:
 * la del gráfico, donde la lista de la página queda tapada por el diálogo.
 */
export function FilaSubvencionAbrible({ s, onAbrir }: { s: SubvencionConResumen; onAbrir: () => void }) {
  const info = SUBVENCION_ESTADO_INFO[s.estado]
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      className="group flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {s.codigo && <CodigoSubvencion codigo={s.codigo} nombre={s.nombre} color={s.color} />}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", info.fase === "descartada" && "text-muted-foreground")}>{s.nombre}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <EstadoPunto s={s} />
          <span className="shrink-0">{info.label}</span>
          {s.financiador && <span className="truncate">· {s.financiador.nombre}</span>}
        </span>
      </span>
      <ImporteFila s={s} />
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}

function EstadoPunto({ s }: { s: SubvencionConResumen }) {
  const info = SUBVENCION_ESTADO_INFO[s.estado]
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", info.dotClass)} title={info.label} aria-label={info.label} />
}

function ImporteFila({ s, corto = false }: { s: SubvencionConResumen; corto?: boolean }) {
  const { valor, que } = importeDeFila(s)
  if (valor == null) return <span className="shrink-0 text-xs text-muted-foreground">—</span>
  const pedido = que === "solicitado"
  if (corto) {
    return (
      <span className={cn("shrink-0 tabular-nums", pedido && "text-muted-foreground")} title={pedido ? "Solicitado" : "Concedido"}>
        {formatCurrency(valor)}
      </span>
    )
  }
  return (
    <span className="shrink-0 text-right">
      <span className={cn("block text-sm tabular-nums", pedido && "text-muted-foreground")}>{formatCurrency(valor)}</span>
      <span className="block text-[11px] text-muted-foreground">{pedido ? "solicitado" : "concedido"}</span>
    </span>
  )
}
