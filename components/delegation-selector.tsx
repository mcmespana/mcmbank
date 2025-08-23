"use client"

import { useState } from "react"
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
  const { delegations, loading } = useDelegationContext()

  const selectedDelegation = delegations.find((delegation) => delegation.id === value)

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between bg-transparent"
          data-testid="delegation-selector"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {selectedDelegation ? selectedDelegation.nombre : "Seleccionar delegación"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar delegación..." />
          <CommandList>
            <CommandEmpty>No se encontraron delegaciones.</CommandEmpty>
            <CommandGroup>
              {delegations.map((delegation) => (
                <CommandItem
                  key={delegation.id}
                  value={delegation.id}
                  onSelect={(currentValue) => {
                    // Always set the selected delegation; avoid toggling to empty string
                    onValueChange?.(currentValue)
                    setOpen(false)
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
