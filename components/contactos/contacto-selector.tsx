"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { Check, ChevronsUpDown, Plus, TriangleAlert, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { CONTACTO_TIPO_DEFAULT_EMOJIS, CONTACTO_TIPO_INFO, CONTACTO_TIPO_ORDER } from "@/lib/utils/contacto-tipos"
import type { ContactoConCategoriaPredeterminada, ContactoTipo } from "@/lib/types/database"
import { archivadoEfectivoContacto, nombreEfectivoContacto } from "@/lib/types/database"

interface ContactoSelectorProps {
  contactos: ContactoConCategoriaPredeterminada[]
  value?: string | null
  onChange: (contactoId: string | null) => void
  onCreateNew?: (initialNombre: string) => void
  /** Aviso de que se ha adoptado un proveedor del catálogo, para releer la lista. */
  onAdopted?: () => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function ContactoSelector({
  contactos,
  value,
  onChange,
  onCreateNew,
  onAdopted,
  placeholder = "Sin contacto",
  disabled,
  loading,
  className,
}: ContactoSelectorProps) {
  const { selectedDelegation } = useDelegationContext()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  // Los que se acaban de adoptar aquí, para no seguir enseñándolos en el
  // catálogo mientras el padre no haya vuelto a leer la lista.
  const [adoptadosAhora, setAdoptadosAhora] = useState<string[]>([])

  const selected = useMemo(
    () => (value ? contactos.find((c) => c.id === value) ?? null : null),
    [value, contactos],
  )

  const grouped = useMemo(() => {
    const result: Record<ContactoTipo, ContactoConCategoriaPredeterminada[]> = {
      proveedor: [],
      persona_mcm: [],
      destinatario_mcm: [],
    }
    for (const c of contactos) {
      if ((c.en_catalogo && !adoptadosAhora.includes(c.id)) || archivadoEfectivoContacto(c)) continue
      result[c.tipo].push(c)
    }
    return result
  }, [contactos, adoptadosAhora])

  /**
   * Proveedores que ya existen en MCM pero que esta delegación no usa. Es la
   * pieza que evita los duplicados: se ofrece el original justo en el momento
   * en el que ibas a crear el tuyo.
   */
  const catalogo = useMemo(
    () => contactos.filter((c) => c.en_catalogo && !adoptadosAhora.includes(c.id)),
    [contactos, adoptadosAhora],
  )

  /**
   * Elegir un proveedor del catálogo es empezar a usarlo, así que se adopta en el
   * mismo gesto. Se hace aquí y no en cada pantalla porque el selector aparece en
   * seis sitios y ninguno tiene por qué saber de la tabla de adopciones.
   */
  const adoptarYSeleccionar = async (contacto: ContactoConCategoriaPredeterminada) => {
    if (!selectedDelegation) {
      toast.error("Selecciona una delegación antes de usar un proveedor del catálogo")
      return
    }
    try {
      await DatabaseService.adoptarContacto(contacto.id, selectedDelegation)
      setAdoptadosAhora((prev) => [...prev, contacto.id])
      onChange(contacto.id)
      setOpen(false)
      onAdopted?.()
    } catch (error) {
      console.error("Error adoptando el contacto del catálogo:", error)
      toast.error("No se pudo añadir el proveedor a tu delegación")
    }
  }

  const trimmedSearch = search.trim()
  const hasExactMatch = useMemo(
    () => contactos.some((c) => c.nombre.toLowerCase() === trimmedSearch.toLowerCase()),
    [contactos, trimmedSearch],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "w-full justify-between font-normal bg-background border-border hover:bg-muted/50 h-9",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <EntityAvatar
                  name={selected.nombre}
                  emoji={selected.emoji}
                  defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                  colorHex={selected.color}
                  logoUrl={selected.logo_url}
                  size="sm"
                  seed={`contacto:${selected.id}`}
                />
                <span className="truncate">{nombreEfectivoContacto(selected)}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-tight",
                    CONTACTO_TIPO_INFO[selected.tipo].bgClass,
                    CONTACTO_TIPO_INFO[selected.tipo].textClass,
                    CONTACTO_TIPO_INFO[selected.tipo].borderClass,
                  )}
                >
                  <span className={cn("h-1 w-1 rounded-full", CONTACTO_TIPO_INFO[selected.tipo].dotClass)} aria-hidden />
                  {CONTACTO_TIPO_INFO[selected.tipo].shortLabel}
                </span>
                {selected.tipo === "proveedor" && !selected.identificador_fiscal && (
                  <span title="Falta el NIF/CIF" className="shrink-0">
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-500" aria-label="Falta el NIF/CIF" />
                  </span>
                )}
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5" />
                <span>{placeholder}</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[80]" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar contacto…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            // Este desplegable se abre casi siempre desde un panel lateral, y
            // Radix bloquea la rueda del ratón en todo lo que se portalea fuera
            // del panel: la lista se quedaba quieta y había que arrastrar la
            // barra. Cuando ese bloqueo ha cancelado el scroll nativo
            // (defaultPrevented), se mueve la lista a mano; si no lo ha
            // cancelado, no se toca nada y desplaza el navegador como siempre.
            onWheel={(event) => {
              if (event.defaultPrevented) {
                event.currentTarget.scrollTop += event.deltaY
              }
            }}
          >
            <CommandEmpty>Sin resultados.</CommandEmpty>

            {value && (
              <CommandGroup>
                <CommandItem
                  value="__limpiar__"
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  <X className="mr-2 h-4 w-4 text-muted-foreground" />
                  Quitar contacto
                </CommandItem>
              </CommandGroup>
            )}

            {CONTACTO_TIPO_ORDER.map((tipo) => {
              const items = grouped[tipo]
              if (items.length === 0) return null
              const info = CONTACTO_TIPO_INFO[tipo]
              return (
                <CommandGroup key={tipo} heading={info.label}>
                  {items.map((c) => {
                    const isSelected = c.id === value
                    const searchValue = `${c.nombre} ${c.email ?? ""} ${c.identificador_fiscal ?? ""} ${c.iban ?? ""}`
                    return (
                      <CommandItem
                        key={c.id}
                        value={`${c.id}__${searchValue}`}
                        onSelect={() => {
                          onChange(c.id)
                          setOpen(false)
                        }}
                      >
                        <EntityAvatar
                          name={c.nombre}
                          emoji={c.emoji}
                          defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                          colorHex={c.color}
                          logoUrl={c.logo_url}
                          size="sm"
                          seed={`contacto:${c.id}`}
                          className="mr-2"
                        />
                        <div className="flex-1 truncate">
                          <div className="flex items-center gap-1 truncate">
                            <span className="truncate font-medium">{nombreEfectivoContacto(c)}</span>
                            {c.tipo === "proveedor" && !c.identificador_fiscal && (
                              <span title="Falta el NIF/CIF" className="shrink-0">
                                <TriangleAlert className="h-3 w-3 text-amber-500" aria-label="Falta el NIF/CIF" />
                              </span>
                            )}
                          </div>
                          {(c.email || c.identificador_fiscal) && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {c.identificador_fiscal ?? c.email}
                            </div>
                          )}
                        </div>
                        <Check className={cn("ml-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}

            {catalogo.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Ya existe en MCM (otras delegaciones lo usan)">
                  {catalogo.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.id}__${c.nombre} ${c.identificador_fiscal ?? ""}`}
                      onSelect={() => void adoptarYSeleccionar(c)}
                    >
                      <EntityAvatar
                        name={c.nombre}
                        emoji={c.emoji}
                        defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                        colorHex={c.color}
                        logoUrl={c.logo_url}
                        size="sm"
                        seed={`contacto:${c.id}`}
                        className="mr-2"
                      />
                      <div className="flex-1 truncate">
                        <div className="truncate font-medium">{c.nombre}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.usos_delegaciones && c.usos_delegaciones > 0
                            ? `Lo usan ${c.usos_delegaciones} ${c.usos_delegaciones === 1 ? "delegación" : "delegaciones"}`
                            : "En el catálogo de MCM"}
                        </div>
                      </div>
                      <Plus className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__crear__${trimmedSearch}`}
                    onSelect={() => {
                      onCreateNew(trimmedSearch)
                      setOpen(false)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {trimmedSearch && !hasExactMatch
                      ? `Crear contacto "${trimmedSearch}"`
                      : "Crear nuevo contacto…"}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
