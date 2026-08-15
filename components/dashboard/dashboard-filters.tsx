"use client"

import { useMemo, useState } from "react"
import { Filter, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CategoryMegaSelector } from "@/components/transactions/category-mega-selector"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import type { Categoria, ContactoConCategoriaPredeterminada } from "@/lib/types/database"
import { nombreEfectivoContacto } from "@/lib/types/database"

interface DashboardFiltersProps {
  categorias: Categoria[]
  selectedCategories: string[]
  onCategoriesChange: (ids: string[]) => void
  contactos: ContactoConCategoriaPredeterminada[]
  selectedContacto: string | null
  onContactoChange: (id: string | null) => void
  isPending?: boolean
  /** Texto de ayuda cuando no hay ningún filtro puesto. */
  hint?: string
}

/**
 * La barra de filtros del dashboard, una sola vez.
 *
 * Balance y Análisis tenían esta misma barra escrita por duplicado, con textos
 * distintos ("Elegir actividad o categoría" contra "Filtrar categorías") y sin
 * el filtro de contacto en ninguna de las dos. Al ser la misma pregunta sobre
 * los mismos datos, conviene que se vea y se comporte igual en las dos.
 */
export function DashboardFilters({
  categorias,
  selectedCategories,
  onCategoriesChange,
  contactos,
  selectedContacto,
  onContactoChange,
  isPending,
  hint,
}: DashboardFiltersProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)

  const chipsCategorias = useMemo(
    () =>
      selectedCategories
        .map((id) => categorias.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [selectedCategories, categorias],
  )

  const contacto = useMemo(
    () => (selectedContacto ? contactos.find((c) => c.id === selectedContacto) ?? null : null),
    [selectedContacto, contactos],
  )

  const hayFiltros = selectedCategories.length > 0 || Boolean(selectedContacto)

  const limpiar = () => {
    onCategoriesChange([])
    onContactoChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectorOpen(true)}>
          <Filter className="h-4 w-4" />
          {selectedCategories.length > 0 ? "Cambiar actividad" : "Actividad o categoría"}
        </Button>

        {/* El selector de contacto trae su propio buscador y el catálogo de MCM,
            así que aquí basta con darle el ancho que necesita. */}
        <div className="w-full sm:w-64">
          <ContactoSelector
            contactos={contactos}
            value={selectedContacto}
            onChange={onContactoChange}
            placeholder="Cualquier contacto"
          />
        </div>

        {hayFiltros && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={limpiar}>
            Limpiar
          </Button>
        )}

        {isPending && <span className="text-xs text-muted-foreground">Aplicando filtros…</span>}
      </div>

      {(chipsCategorias.length > 0 || contacto) && (
        <div className="flex flex-wrap items-center gap-2">
          {contacto && (
            <Badge variant="secondary" className="gap-1.5 pl-1 pr-1 font-normal">
              <EntityAvatar
                name={contacto.nombre}
                emoji={contacto.emoji}
                defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                colorHex={contacto.color}
                logoUrl={contacto.logo_url}
                size="sm"
                className="h-4 w-4 rounded"
              />
              {nombreEfectivoContacto(contacto)}
              <button
                type="button"
                onClick={() => onContactoChange(null)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Quitar ${contacto.nombre}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {chipsCategorias.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 pr-1 font-normal">
              {c.emoji && <span>{c.emoji}</span>}
              {c.nombre}
              <button
                type="button"
                onClick={() => onCategoriesChange(selectedCategories.filter((id) => id !== c.id))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Quitar ${c.nombre}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {!hayFiltros && hint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {hint}
        </p>
      )}

      {selectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <CategoryMegaSelector
            categories={categorias}
            selectedCategories={selectedCategories}
            onSelectionChange={onCategoriesChange}
            onClose={() => setSelectorOpen(false)}
            allowMultiple
            title="Elegir actividad o categoría"
          />
        </div>
      )}
    </div>
  )
}
