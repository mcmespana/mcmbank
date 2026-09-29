"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Maximize2, Repeat, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionMenu } from "@/components/ui/action-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SubvencionFicha } from "./subvencion-ficha"
import { SubvencionFormDialog } from "./subvencion-form-dialog"
import { useSubvenciones } from "@/hooks/use-subvenciones"
import { eliminarSubvencion, restaurarSubvencion } from "@/lib/services/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import type { Subvencion, SubvencionConResumen } from "@/lib/types/database"

/**
 * La del año que viene, a partir de esta: lo que no cambia de un año a otro
 * (quién, qué, quién la pide, enlaces) y nada de lo que sí (fechas, importes,
 * expediente). Casi todas salen cada año, y en el Excel se copiaba la fila.
 */
export function plantillaSiguiente(s: Subvencion): Partial<Subvencion> {
  return {
    id: `repetir-${s.id}`,
    codigo: s.codigo,
    nombre: s.nombre,
    financiador_id: s.financiador_id,
    solicitante: s.solicitante,
    delegacion_id: s.delegacion_id,
    convocatoria: s.convocatoria,
    recurrente: s.recurrente,
    enlaces: s.enlaces,
    ejercicio: (s.ejercicio ?? new Date().getFullYear()) + 1,
    estado: "no_convocada",
    notas: s.notas,
  }
}

/**
 * Menú ⋯ de una subvención: repetirla el año que viene y borrarla (con
 * deshacer). Lo comparten la hoja lateral y la página de detalle.
 */
export function AccionesSubvencion({
  subvencion,
  enCapa = false,
  onBorrada,
  onCreada,
}: {
  subvencion: SubvencionConResumen
  enCapa?: boolean
  onBorrada?: () => void
  onCreada?: (s: Subvencion) => void
}) {
  const router = useRouter()
  const { invalidar } = useSubvenciones({ enabled: false })
  const [repetirOpen, setRepetirOpen] = useState(false)
  const siguiente = (subvencion.ejercicio ?? new Date().getFullYear()) + 1

  const borrar = async () => {
    try {
      const borrada = await eliminarSubvencion(subvencion.id)
      onBorrada?.()
      invalidar()
      const n = borrada.imputaciones.length
      toast.success(n ? `Subvención borrada. Sus ${n} movimientos quedan libres.` : "Subvención borrada", {
        duration: 12000,
        action: {
          label: "Deshacer",
          onClick: () => {
            restaurarSubvencion(borrada)
              .then(() => {
                invalidar()
                toast.success("Subvención recuperada")
              })
              .catch((err) => toast.error(describirError(err, "No se ha podido recuperar la subvención")))
          },
        },
      })
    } catch (err) {
      toast.error(describirError(err, "No se ha podido borrar la subvención"))
    }
  }

  return (
    <>
      <ActionMenu
        ariaLabel={`Más acciones de ${subvencion.codigo || subvencion.nombre}`}
        contentClassName={enCapa ? "z-[80]" : undefined}
        items={[
          { label: `Repetir en ${siguiente}`, icon: Repeat, onSelect: () => setRepetirOpen(true) },
          { label: "Borrar subvención", icon: Trash2, destructive: true, onSelect: borrar },
        ]}
      />
      <SubvencionFormDialog
        open={repetirOpen}
        onOpenChange={setRepetirOpen}
        plantilla={plantillaSiguiente(subvencion)}
        enCapa={enCapa}
        onSaved={async (nueva) => {
          if (!onCreada) {
            invalidar()
            router.push(`/subvenciones/${nueva.id}`)
            return
          }
          // Con la lista ya al día: abrir un id que aún no tiene cerraría la hoja un instante.
          await invalidar()
          onCreada(nueva)
        }}
      />
    </>
  )
}

interface SubvencionSheetProps {
  /** La que está abierta, o null. */
  subvencion: SubvencionConResumen | null
  /** Las que se ven en la lista, en su orden: para ir a la anterior y a la siguiente sin cerrar. */
  orden: string[]
  /** `anio` cambia también de pestaña: la de repetir en N+1 vive en otro año. */
  onAbrir: (id: string | null, anio?: string) => void
}

/**
 * La ficha en una hoja lateral amplia, encima de la lista.
 *
 * **Hoja y no diálogo**, a propósito: se entra, se cambia el estado o un
 * importe y se pasa a la siguiente sin perder el sitio en la lista —que es
 * como se repasa un año entero—, y la ficha es una columna larga que en un
 * diálogo centrado se queda corta de alto. Los movimientos imputados, que son
 * una tabla ancha, siguen en su página (`/subvenciones/[id]`).
 */
export function SubvencionSheet({ subvencion, orden, onAbrir }: SubvencionSheetProps) {
  const pos = subvencion ? orden.indexOf(subvencion.id) : -1
  const anterior = pos > 0 ? orden[pos - 1] : null
  const siguiente = pos >= 0 && pos < orden.length - 1 ? orden[pos + 1] : null

  return (
    <Sheet open={Boolean(subvencion)} onOpenChange={(o) => !o && onAbrir(null)}>
      <SheetContent
        side="right"
        className="z-[60] flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl lg:max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {subvencion && (
          <>
            <SheetHeader className="flex-row items-center gap-1 space-y-0 border-b px-4 py-2.5 pr-12 text-left">
              <SheetTitle className="sr-only">{subvencion.nombre}</SheetTitle>
              <SheetDescription className="sr-only">Ficha editable de la subvención</SheetDescription>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!anterior}
                onClick={() => anterior && onAbrir(anterior)}
                aria-label="Subvención anterior"
                title="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!siguiente}
                onClick={() => siguiente && onAbrir(siguiente)}
                aria-label="Subvención siguiente"
                title="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {pos >= 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pos + 1} de {orden.length}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild className="h-8 text-muted-foreground">
                  <Link href={`/subvenciones/${subvencion.id}`}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    Abrir entera
                  </Link>
                </Button>
                <AccionesSubvencion
                  subvencion={subvencion}
                  enCapa
                  onBorrada={() => onAbrir(siguiente ?? anterior ?? null)}
                  onCreada={(nueva) => onAbrir(nueva.id, nueva.ejercicio == null ? undefined : String(nueva.ejercicio))}
                />
              </div>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {/* La clave rehace la ficha al cambiar de subvención: ningún campo a medio editar pasa a la siguiente. */}
              <SubvencionFicha key={subvencion.id} subvencion={subvencion} enCapa />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
