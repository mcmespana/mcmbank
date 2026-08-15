"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { DateField } from "@/components/ui/date-field"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { CategoryChip } from "@/components/transactions/category-chip"
import type { Categoria, ContactoConCategoriaPredeterminada } from "@/lib/types/database"

export interface FacturaDatosFieldsValue {
  contactoId: string | null
  categoriaId: string | null
  concepto: string
  numero: string
  fechaEmision: string | null
  /** Importe formateado en texto para MoneyInput, p.ej. "3.048,22". */
  importeDisplay: string
  notas: string
}

/** Campos que se pueden pedir enfocar al abrir (el primero que falte). */
export type FacturaCampoEnfocable = "concepto" | "importe" | "fecha" | "numero"

/** Los `id` de los inputs, para que el panel pueda enfocarlos sin refs. */
export const FACTURA_CAMPO_IDS: Record<FacturaCampoEnfocable, string> = {
  concepto: "factura-concepto",
  importe: "factura-importe",
  fecha: "factura-fecha",
  numero: "factura-numero",
}

interface FacturaDatosFieldsProps {
  value: FacturaDatosFieldsValue
  onChange: (patch: Partial<FacturaDatosFieldsValue>) => void
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Categoria[]
  onCreateContacto?: (initialNombre: string) => void
  /** Recarga la lista de contactos tras adoptar uno del catálogo. */
  onContactoAdoptado?: () => void
}

/**
 * Campos de datos de una factura. Sin selector de Estado (lo calculan los
 * triggers de scripts/048) y sin Notas internas: las notas no son un dato de
 * la factura sino un recado para el equipo, y vivían aquí en medio empujando
 * la conciliación —que es el trabajo— hasta el final del panel.
 */
export function FacturaDatosFields({
  value,
  onChange,
  contactos,
  categorias,
  onCreateContacto,
  onContactoAdoptado,
}: FacturaDatosFieldsProps) {
  const categoria = categorias.find((c) => c.id === value.categoriaId)

  return (
    <div className="space-y-4">
      {/* Proveedor */}
      <div className="space-y-1.5">
        <Label>Proveedor</Label>
        <ContactoSelector
          contactos={contactos}
          value={value.contactoId}
          onChange={(id) => onChange({ contactoId: id })}
          onCreateNew={onCreateContacto}
          onAdopted={onContactoAdoptado}
          placeholder="¿Quién emite la factura?"
        />
        <p className="text-[11px] text-muted-foreground">Si no existe puedes crearlo aquí.</p>
      </div>

      {/* Categoría: el mismo selector que Movimientos (CategoryChip), para que
          la categoría que se acepte aquí sea la misma que luego se propaga al
          movimiento al conciliar. */}
      <div className="space-y-1.5">
        <Label>Categoría</Label>
        <CategoryChip
          category={categoria}
          categories={categorias}
          onCategoryChange={(categoriaId) => onChange({ categoriaId })}
        />
      </div>

      {/* Concepto */}
      <div className="space-y-1.5">
        <Label htmlFor={FACTURA_CAMPO_IDS.concepto}>Concepto</Label>
        <Input
          id={FACTURA_CAMPO_IDS.concepto}
          value={value.concepto}
          onChange={(e) => onChange({ concepto: e.target.value })}
          placeholder="P.ej. Material del campamento de verano"
        />
      </div>

      {/* Importe + fecha. Las dos celdas llevan `min-w-0`: un input trae de
          fábrica un ancho mínimo de unos 170px y, sin eso, la rejilla se niega
          a bajar de la suma de los dos y desborda el panel en un móvil. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={FACTURA_CAMPO_IDS.importe}>Importe</Label>
          <div className="relative">
            <MoneyInput
              id={FACTURA_CAMPO_IDS.importe}
              value={value.importeDisplay}
              onValueChange={(display) => onChange({ importeDisplay: display })}
              placeholder="0,00"
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              €
            </span>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={FACTURA_CAMPO_IDS.fecha}>Fecha de emisión</Label>
          <DateField
            id={FACTURA_CAMPO_IDS.fecha}
            value={value.fechaEmision}
            onChange={(iso) => onChange({ fechaEmision: iso })}
          />
        </div>
      </div>

      {/* Número de factura */}
      <div className="space-y-1.5">
        <Label htmlFor={FACTURA_CAMPO_IDS.numero}>
          Nº de factura <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={FACTURA_CAMPO_IDS.numero}
          value={value.numero}
          onChange={(e) => onChange({ numero: e.target.value })}
          placeholder="P.ej. 2026-0042"
        />
      </div>
    </div>
  )
}
