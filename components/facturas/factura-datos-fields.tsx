"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

interface FacturaDatosFieldsProps {
  value: FacturaDatosFieldsValue
  onChange: (patch: Partial<FacturaDatosFieldsValue>) => void
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Categoria[]
  onCreateContacto?: (initialNombre: string) => void
}

/**
 * Campos de datos de una factura, extraídos de factura-form.tsx para poder
 * vivir dentro de factura-detail-sheet.tsx junto a la conciliación. Sin
 * selector de Estado (lo calculan los triggers de scripts/048).
 */
export function FacturaDatosFields({
  value,
  onChange,
  contactos,
  categorias,
  onCreateContacto,
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
          placeholder="¿Quién emite la factura?"
        />
        <p className="text-[11px] text-muted-foreground">
          Si no existe, escríbelo y créalo al vuelo sin salir de aquí.
        </p>
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
        <Label htmlFor="factura-concepto">Concepto</Label>
        <Input
          id="factura-concepto"
          value={value.concepto}
          onChange={(e) => onChange({ concepto: e.target.value })}
          placeholder="P.ej. Material del campamento de verano"
        />
      </div>

      {/* Importe + fecha */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="factura-importe">Importe</Label>
          <div className="relative">
            <MoneyInput
              id="factura-importe"
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
        <div className="space-y-1.5">
          <Label htmlFor="factura-fecha">Fecha de emisión</Label>
          <DateField
            id="factura-fecha"
            value={value.fechaEmision}
            onChange={(iso) => onChange({ fechaEmision: iso })}
          />
        </div>
      </div>

      {/* Número de factura */}
      <div className="space-y-1.5">
        <Label htmlFor="factura-numero">
          Nº de factura <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="factura-numero"
          value={value.numero}
          onChange={(e) => onChange({ numero: e.target.value })}
          placeholder="P.ej. 2026-0042"
        />
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="factura-notas">Notas internas</Label>
        <Textarea
          id="factura-notas"
          value={value.notas}
          onChange={(e) => onChange({ notas: e.target.value })}
          placeholder="Notas privadas para el equipo (opcional)."
          rows={2}
        />
      </div>
    </div>
  )
}
