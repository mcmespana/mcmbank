"use client"

import { useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ContactoForm } from "@/components/contactos/contacto-form"
import type { Contacto, Categoria } from "@/lib/types/database"

type ContactoFormSubmitPayload = Parameters<NonNullable<React.ComponentProps<typeof ContactoForm>["onSubmit"]>>[0]

interface UseCreateContactoInlineParams {
  delegacionId?: string | null
  categorias: Categoria[]
  canManageGlobal?: boolean
  onCreateContacto?: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onContactoCreated: (contactoId: string) => void
}

/**
 * Crear un contacto al vuelo desde un ContactoSelector (Sheet "Nuevo
 * contacto" + wiring de onCreateNew), compartido entre transaction-create-panel
 * y transaction-detail — antes duplicado idéntico en ambos.
 */
export function useCreateContactoInline({
  delegacionId,
  categorias,
  canManageGlobal,
  onCreateContacto,
  onContactoCreated,
}: UseCreateContactoInlineParams): { onCreateNew?: (initialNombre: string) => void; dialog: ReactNode } {
  const [open, setOpen] = useState(false)
  const [initialNombre, setInitialNombre] = useState("")

  if (!onCreateContacto) {
    return { onCreateNew: undefined, dialog: null }
  }

  return {
    onCreateNew: (nombre: string) => {
      setInitialNombre(nombre)
      setOpen(true)
    },
    dialog: (
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Sin capa propia: este panel siempre se abre desde otro panel (el
            detalle o el alta de un movimiento) que ya está oscureciendo el
            fondo. Con la suya, el lateral izquierdo se oscurecía dos veces. */}
        <SheetContent overlay={false} side="right" className="w-full sm:max-w-xl overflow-y-auto z-[70] shadow-2xl">
          <SheetHeader className="mb-2">
            <SheetTitle>Nuevo contacto</SheetTitle>
          </SheetHeader>
          <ContactoForm
            delegacionId={delegacionId ?? null}
            contacto={null}
            categorias={categorias as any}
            canManageGlobal={Boolean(canManageGlobal)}
            defaultNombre={initialNombre}
            onSubmit={async (payload) => {
              const created = (await onCreateContacto(payload)) as Contacto | void
              if (created?.id) onContactoCreated(created.id)
              return created
            }}
            onCancel={() => setOpen(false)}
            onSaved={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    ),
  }
}
