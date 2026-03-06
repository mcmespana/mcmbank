"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useDelegationContext } from "@/contexts/delegation-context"

interface DelegationSelectorProps {
  value?: string | null
  onValueChange?: (value: string) => void
}

export function DelegationSelector({ value, onValueChange }: DelegationSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { delegations, loading } = useDelegationContext()

  const selectedDelegation = delegations.find((delegation) => delegation.id === value)

  const normalizeForSearch = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()

  const searchQuery = search.trim().toLowerCase()
  const normalizedQuery = normalizeForSearch(searchQuery)

  const filteredDelegations = useMemo(() => {
    if (!searchQuery) {
      return delegations
    }

    const isCodeSearch = searchQuery.startsWith("mcm-")

    const ranked = delegations
      .map((delegation) => {
        const name = delegation.nombre || ""
        const code = delegation.codigo || ""
        const normalizedName = normalizeForSearch(name)
        const normalizedCode = normalizeForSearch(code)

        let score = 0

        if (isCodeSearch) {
          if (normalizedCode.startsWith(normalizedQuery)) {
            score += 120
          } else if (normalizedCode.includes(normalizedQuery)) {
            score += 90
          } else {
            return null
          }
        }

        if (!isCodeSearch) {
          if (normalizedName.startsWith(normalizedQuery)) score += 80
          if (normalizedName.includes(normalizedQuery)) score += 60
          if (normalizedCode.startsWith(normalizedQuery)) score += 55
          if (normalizedCode.includes(normalizedQuery)) score += 40

          if (normalizedQuery.length >= 3 && normalizedName.includes(normalizedQuery.slice(0, 3))) {
            score += 20
          }

          if (score === 0) return null
        }

        return { delegation, score }
      })
      .filter((entry): entry is { delegation: (typeof delegations)[number]; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.delegation.nombre.localeCompare(b.delegation.nombre, "es"))

    return ranked.map((entry) => entry.delegation)
  }, [delegations, normalizedQuery, searchQuery])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearch("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent"
          data-testid="delegation-selector"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">
              {selectedDelegation ? selectedDelegation.nombre : "Seleccionar delegación"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] sm:w-[250px] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar delegación..." />
          <CommandList>
            <CommandEmpty>No se encontraron delegaciones.</CommandEmpty>
            <CommandGroup>
              {filteredDelegations.map((delegation) => (
                <CommandItem
                  key={delegation.id}
                  value={delegation.id}
                  onSelect={() => {
                    // Always set the selected delegation; avoid toggling to empty string
                    onValueChange?.(delegation.id)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === delegation.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{delegation.nombre}</span>
                    {delegation.codigo && <span className="text-xs text-muted-foreground">{delegation.codigo}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
