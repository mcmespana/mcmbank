"use client"

import { useState } from "react"
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { aceptarCategoriaIa, leerFacturaConIa } from "@/lib/services/factura-ia-client"
import { categoriaPendienteDeAceptar, leerDatosIa } from "@/lib/types/factura-ia"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface FacturaIaPanelProps {
  factura: FacturaConRelaciones
  canEdit: boolean
  /** Se llama tras leer o aceptar, para que la lista recargue. */
  onChanged: () => void | Promise<void>
  /** Refleja en el formulario abierto la categoría recién aceptada. */
  onCategoriaAceptada?: (categoriaId: string) => void
}

/**
 * Una línea contando qué ha hecho la lectura automática, y como mucho una
 * decisión que tomar.
 *
 * Antes esto era una caja con el resumen de la lectura, la lista de campos
 * rellenados, el aviso de proveedor nuevo, el de confianza baja, la categoría
 * sugerida y un "volver a leer" — seis cosas para una tarea que en el 90% de
 * los casos es "vale, correcto". El resumen sobra porque los datos leídos ya
 * están ahí abajo, en los campos; lo que no se ve en ningún otro sitio es la
 * categoría sugerida, y eso es lo único que se mantiene con botón propio.
 */
export function FacturaIaPanel({
  factura,
  canEdit,
  onChanged,
  onCategoriaAceptada,
}: FacturaIaPanelProps) {
  const [trabajando, setTrabajando] = useState<"leyendo" | "aceptando" | null>(null)
  const datos = leerDatosIa(factura.datos_ia)
  const categoriaPendiente = categoriaPendienteDeAceptar(datos)

  const leer = async (forzar: boolean) => {
    setTrabajando("leyendo")
    try {
      const resultado = await leerFacturaConIa(factura.id, { forzar })
      if (resultado?.estado === "error") {
        toast.error(resultado.error || "No se pudo leer la factura")
      } else if (resultado?.estado === "sin_documento") {
        toast.info("Esta factura no tiene ningún documento que leer")
      } else {
        toast.success("Factura leída")
      }
      await onChanged()
    } catch (err) {
      toast.error("No se pudo leer: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setTrabajando(null)
    }
  }

  const aceptar = async () => {
    if (!categoriaPendiente?.id) return
    setTrabajando("aceptando")
    try {
      await aceptarCategoriaIa(factura.id, categoriaPendiente.id)
      onCategoriaAceptada?.(categoriaPendiente.id)
      toast.success(`Categoría "${categoriaPendiente.nombre}" aplicada`)
      await onChanged()
    } catch (err) {
      toast.error("No se pudo aplicar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setTrabajando(null)
    }
  }

  // Todavía sin leer: un botón y nada más de ruido.
  if (!datos) {
    if (!canEdit) return null
    return (
      <Tira tono="neutro">
        <span className="flex-1 text-xs text-muted-foreground">
          Puedo leer el documento y rellenar los datos.
        </span>
        <BotonTira onClick={() => leer(false)} disabled={trabajando !== null} icon={Sparkles}>
          {trabajando === "leyendo" ? "Leyendo…" : "Leer con IA"}
        </BotonTira>
      </Tira>
    )
  }

  if (datos.estado === "procesando") {
    return (
      <Tira tono="neutro">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Leyendo el documento…
        </span>
      </Tira>
    )
  }

  if (datos.estado === "error" || datos.estado === "sin_documento") {
    return (
      <Tira tono="aviso">
        <span className="flex-1 text-xs text-amber-800 dark:text-amber-200">
          {datos.error || "No se pudo leer la factura."}
        </span>
        {canEdit && (
          <BotonTira onClick={() => leer(true)} disabled={trabajando !== null} icon={RefreshCw}>
            Reintentar
          </BotonTira>
        )}
      </Tira>
    )
  }

  const dudosa = datos.es_factura === false || (datos.confianza != null && datos.confianza < 0.5)
  const s = datos.sugerencias
  const leido = [
    s?.fecha_emision ? formatDate(s.fecha_emision) : null,
    s?.importe != null ? formatCurrency(s.importe) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-2">
      <Tira tono={dudosa ? "aviso" : "ok"}>
        {dudosa ? (
          <span className="flex-1 text-xs text-amber-800 dark:text-amber-200">
            {datos.es_factura === false
              ? "Esto no parece una factura: comprueba los datos antes de darlos por buenos."
              : "Lectura poco segura: comprueba los datos."}
          </span>
        ) : (
          <span className="flex-1 text-xs text-emerald-800 dark:text-emerald-200">
            Leída con IA{leido ? ` · ${leido}` : ""}. Revisa y confirma.
          </span>
        )}
        {canEdit && (
          <BotonTira onClick={() => leer(true)} disabled={trabajando !== null} icon={RefreshCw}>
            {trabajando === "leyendo" ? "Leyendo…" : "Releer"}
          </BotonTira>
        )}
      </Tira>

      {categoriaPendiente && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2">
          <div className="min-w-0">
            <div className="text-xs font-medium">
              ¿La categorizo como <span className="text-primary">{categoriaPendiente.nombre}</span>?
            </div>
            {categoriaPendiente.motivo && (
              <div className="truncate text-[11px] text-muted-foreground">{categoriaPendiente.motivo}</div>
            )}
          </div>
          <Button type="button" size="sm" onClick={aceptar} disabled={trabajando !== null}>
            {trabajando === "aceptando" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sí, ponla
          </Button>
        </div>
      )}
    </div>
  )
}

function Tira({ children, tono }: { children: React.ReactNode; tono: "ok" | "aviso" | "neutro" }) {
  const Icono = tono === "aviso" ? AlertTriangle : Sparkles
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border px-2.5 py-1.5",
        tono === "aviso"
          ? "border-amber-300/70 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30"
          : tono === "ok"
            ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/25"
            : "border-border/60 bg-muted/30",
      )}
    >
      <Icono
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          tono === "aviso"
            ? "text-amber-600 dark:text-amber-400"
            : tono === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
        )}
        aria-hidden
      />
      {children}
    </div>
  )
}

function BotonTira({
  children,
  onClick,
  disabled,
  icon: Icon,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  icon: typeof Sparkles
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {children}
    </button>
  )
}
