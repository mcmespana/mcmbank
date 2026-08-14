"use client"

import { useState } from "react"
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles, UserPlus } from "lucide-react"
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

const ETIQUETAS_CAMPO: Record<string, string> = {
  numero: "número",
  fecha_emision: "fecha",
  importe: "importe",
  concepto: "concepto",
  contacto_id: "proveedor",
  moneda: "moneda",
}

/**
 * Lo que la IA ha leído de la factura, y lo único que hace falta decidir: la
 * categoría.
 *
 * El resto de campos ya están en el formulario de al lado (se rellenaron solos
 * si estaban vacíos), así que aquí no se repiten como un formulario paralelo:
 * se resumen para que se pueda comprobar de un vistazo que la lectura tiene
 * sentido, y se deja un único botón que sí cambia algo.
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
      <Caja>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Puedo leer el documento y rellenar proveedor, número, fecha e importe.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => leer(false)} disabled={trabajando !== null}>
            {trabajando === "leyendo" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Leer con IA
          </Button>
        </div>
      </Caja>
    )
  }

  if (datos.estado === "procesando") {
    return (
      <Caja>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo el documento…
        </div>
      </Caja>
    )
  }

  if (datos.estado === "error" || datos.estado === "sin_documento") {
    return (
      <Caja tono="aviso">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">
            {datos.error || "No se pudo leer la factura."}
          </p>
          {canEdit && (
            <Button type="button" size="sm" variant="outline" onClick={() => leer(true)} disabled={trabajando !== null}>
              {trabajando === "leyendo" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Reintentar
            </Button>
          )}
        </div>
      </Caja>
    )
  }

  const s = datos.sugerencias
  const resumen = [
    s?.proveedor?.nombre,
    s?.numero ? `nº ${s.numero}` : null,
    s?.fecha_emision ? formatDate(s.fecha_emision) : null,
    s?.importe != null ? formatCurrency(s.importe) : null,
  ].filter(Boolean) as string[]

  const dudosa = datos.es_factura === false || (datos.confianza != null && datos.confianza < 0.5)

  return (
    <Caja>
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs text-foreground">{resumen.join(" · ") || "Sin datos claros"}</span>
          {datos.campos_rellenados.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              (rellenados: {datos.campos_rellenados.map((c) => ETIQUETAS_CAMPO[c] ?? c).join(", ")})
            </span>
          )}
        </div>

        {s?.proveedor?.creado && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UserPlus className="h-3 w-3 shrink-0" aria-hidden />
            Proveedor creado automáticamente: revisa sus datos cuando puedas.
          </div>
        )}

        {dudosa && (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {datos.es_factura === false
              ? "El documento no parece una factura: comprueba los datos antes de darlos por buenos."
              : "Lectura poco segura: comprueba los datos."}
          </div>
        )}

        {categoriaPendiente && canEdit && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-xs font-medium">
                Categoría sugerida: <span className="text-primary">{categoriaPendiente.nombre}</span>
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
              Aceptar
            </Button>
          </div>
        )}

        {datos.categoria_aceptada && s?.categoria?.nombre && (
          <div className="text-[11px] text-muted-foreground">
            Categoría «{s.categoria.nombre}» aceptada.
          </div>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => leer(true)}
            disabled={trabajando !== null}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            {trabajando === "leyendo" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Volver a leer
          </button>
        )}
      </div>
    </Caja>
  )
}

function Caja({ children, tono }: { children: React.ReactNode; tono?: "aviso" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tono === "aviso"
          ? "border-amber-300/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30"
          : "border-primary/25 bg-primary/[0.04]",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3 w-3" aria-hidden /> Lectura automática
      </div>
      {children}
    </div>
  )
}
