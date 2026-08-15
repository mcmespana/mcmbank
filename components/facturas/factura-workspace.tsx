"use client"

import { useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { FacturaVisorDocumento } from "./factura-visor-documento"
import { FacturaPanel, type FacturaPanelSubmit } from "./factura-panel"
import type {
  Categoria,
  Contacto,
  ContactoConCategoriaPredeterminada,
  Factura,
  FacturaConRelaciones,
} from "@/lib/types/database"
import type { ContactoFormSubmitPayload } from "@/components/contactos/contacto-form"

export type { FacturaPanelSubmit as FacturaWorkspaceSubmit }

interface FacturaWorkspaceProps {
  factura: FacturaConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Categoria[]
  canEdit: boolean
  canManageGlobalContact?: boolean
  onCreateContacto?: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onSave: (payload: FacturaPanelSubmit) => Promise<Factura | void>
  onLinkMovimiento: (facturaId: string, movimientoId: string, creadoPor?: string) => Promise<void>
  onUnlinkMovimiento: (facturaId: string, movimientoId: string) => Promise<void>
  onMarcarPagadaFuera: (facturaId: string) => Promise<void>
  onDelete: (factura: FacturaConRelaciones) => Promise<void> | void
  onRefrescar?: () => void | Promise<void>
  onContactosCambiados?: () => void
  /** Si se llegó aquí desde un movimiento, la URL para volver a él. */
  volverHref?: string | null
}

/**
 * Trabajar una factura: el documento a la izquierda, los datos a la derecha.
 *
 * Es el gesto de Holded, y funciona porque rellenar una factura es copiar de un
 * sitio a otro: con el panel flotando sobre la lista había que abrirla, mirar,
 * cerrarla, escribir de memoria y volver a abrirla. El visor de la izquierda es
 * el del navegador (zoom, buscar, páginas, imprimir), no uno de andar por casa.
 *
 * En móvil no hay sitio para dos columnas, así que solo se monta el panel: el
 * documento sigue estando a un toque, desde la sección Documento del final.
 */
export function FacturaWorkspace({
  factura,
  open,
  onOpenChange,
  ...panelProps
}: FacturaWorkspaceProps) {
  const archivo = factura?.archivos?.[0] ?? null
  // Rebuscar entre movimientos es leer filas largas (concepto + importe +
  // cuenta + fecha) en una columna pensada para un formulario. Mientras dura,
  // el panel se come el sitio del documento: se hace poco, y cuando se hace es
  // lo único que se está mirando.
  const [buscando, setBuscando] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex overflow-hidden bg-background outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 lg:inset-4 lg:rounded-2xl lg:border lg:border-border/60 lg:shadow-2xl"
          // El foco lo coloca el panel en el primer campo que falte; dejar que
          // Radix lo lleve al primer elemento enfocable pondría el cursor en el
          // botón de cerrar.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title asChild>
            <VisuallyHidden>
              {factura?.concepto?.trim() || archivo?.nombre_original || "Factura"}
            </VisuallyHidden>
          </DialogPrimitive.Title>

          {/* Documento: solo cuando hay ancho de sobra para las dos columnas. */}
          <div className="hidden min-w-0 flex-1 border-r border-border/40 lg:block">
            <FacturaVisorDocumento archivo={archivo} />
          </div>

          <FacturaPanel
            factura={factura}
            {...panelProps}
            onClose={() => onOpenChange(false)}
            onModoBusquedaChange={setBuscando}
            className={cn(
              "w-full shrink-0 transition-[width] duration-200",
              buscando ? "lg:w-[46rem] xl:w-[52rem]" : "lg:w-[30rem] xl:w-[34rem]",
            )}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
