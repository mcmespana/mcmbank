"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus, Users, X } from "lucide-react"
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
import { CONTACTO_TIPO_INFO, CONTACTO_TIPO_ORDER } from "@/lib/utils/contacto-tipos"
import type { ContactoConCategoriaPredeterminada, ContactoTipo } from "@/lib/types/database"

interface ContactoSelectorProps {
  contactos: ContactoConCategoriaPredeterminada[]
  value?: string | null
  onChange: (contactoId: string | null) => void
  onCreateNew?: (initialNombre: string) => void
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
  placeholder = "Sin contacto",
  disabled,
  loading,
  className,
}: ContactoSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

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
      if (c.archivado) continue
      result[c.tipo].push(c)
    }
    return result
  }, [contactos])

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
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span aria-hidden>{selected.emoji ?? CONTACTO_TIPO_INFO[selected.tipo].emoji}</span>
                <span className="truncate">{selected.nombre}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                    CONTACTO_TIPO_INFO[selected.tipo].bgClass,
                    CONTACTO_TIPO_INFO[selected.tipo].textClass,
                  )}
                >
                  {CONTACTO_TIPO_INFO[selected.tipo].shortLabel}
                </span>
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar contacto…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
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
                <CommandGroup key={tipo} heading={`${info.emoji} ${info.label}`}>
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
                        <span className="mr-2">{c.emoji ?? info.emoji}</span>
                        <div className="flex-1 truncate">
                          <div className="truncate font-medium">{c.nombre}</div>
                          {(c.email || c.identificador_fiscal) && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {c.identificador_fiscal ?? c.email}
                            </div>
                          )}
                        </div>
                        {c.es_global && (
                          <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Global
                          </span>
                        )}
                        <Check className={cn("ml-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}

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
