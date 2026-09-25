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

type FiltroTipo = ContactoTipo | "todos"

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** Todas las palabras de la búsqueda, en cualquier orden y sin tildes. */
function coincide(c: ContactoConCategoriaPredeterminada, palabras: string[]) {
  if (palabras.length === 0) return true
  const texto = normalizar(
    [nombreEfectivoContacto(c), c.nombre, c.email, c.identificador_fiscal, c.iban].filter(Boolean).join(" "),
  )
  return palabras.every((p) => texto.includes(p))
}

interface ContactoSelectorProps {
  contactos: ContactoConCategoriaPredeterminada[]
  value?: string | null
  onChange: (contactoId: string | null) => void
  /** Recibe también el tipo que se estaba mirando, para que el alta nazca de ese tipo. */
  onCreateNew?: (initialNombre: string, tipo?: ContactoTipo) => void
  /** Aviso de que se ha adoptado un proveedor del catálogo, para releer la lista. */
  onAdopted?: () => void
  placeholder?: string
  /**
   * Tipo con el que se abre la lista. En un pago MCM casi siempre se busca a
   * una persona y en una factura a un proveedor: sin esto había que pasar por
   * todos los proveedores para llegar a la gente. Sigue habiendo "Todos".
   */
  tipoInicial?: ContactoTipo
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
  tipoInicial,
  disabled,
  loading,
  className,
}: ContactoSelectorProps) {
  const { selectedDelegation } = useDelegationContext()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>("todos")
  // Los que se acaban de adoptar aquí, para no seguir enseñándolos en el
  // catálogo mientras el padre no haya vuelto a leer la lista.
  const [adoptadosAhora, setAdoptadosAhora] = useState<string[]>([])

  const selected = useMemo(
    () => (value ? contactos.find((c) => c.id === value) ?? null : null),
    [value, contactos],
  )

  // Los catálogos cuentan como proveedores: el chip tiene que estar para llegar a ellos.
  const tiposPresentes = useMemo(
    () => new Set(contactos.filter((c) => !archivadoEfectivoContacto(c)).map((c) => c.tipo)),
    [contactos],
  )

  // Cada vez que se abre empieza limpio y en el tipo que toca. Si ya hay un
  // contacto de otro tipo elegido se abre en "Todos", para que se vea marcado.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const usarTipoInicial =
        tipoInicial &&
        tiposPresentes.size > 1 &&
        tiposPresentes.has(tipoInicial) &&
        (!selected || selected.tipo === tipoInicial)
      setSearch("")
      setTipoFiltro(usarTipoInicial ? tipoInicial : "todos")
    }
    setOpen(next)
  }

  const palabras = useMemo(() => normalizar(search).split(/\s+/).filter(Boolean), [search])

  const coincidentes = useMemo(
    () =>
      contactos.filter(
        (c) =>
          !(c.en_catalogo && !adoptadosAhora.includes(c.id)) &&
          !archivadoEfectivoContacto(c) &&
          coincide(c, palabras),
      ),
    [contactos, adoptadosAhora, palabras],
  )

  const conteoPorTipo = useMemo(() => {
    const result: Record<ContactoTipo, number> = { proveedor: 0, persona_mcm: 0, destinatario_mcm: 0 }
    for (const c of coincidentes) result[c.tipo]++
    return result
  }, [coincidentes])

  const grouped = useMemo(() => {
    const result: Record<ContactoTipo, ContactoConCategoriaPredeterminada[]> = {
      proveedor: [],
      persona_mcm: [],
      destinatario_mcm: [],
    }
    for (const c of coincidentes) {
      if (tipoFiltro === "todos" || c.tipo === tipoFiltro) result[c.tipo].push(c)
    }
    return result
  }, [coincidentes, tipoFiltro])

  // Con "Todos", el tipo que se busca aquí va primero.
  const ordenTipos = useMemo(
    () => (tipoInicial ? [tipoInicial, ...CONTACTO_TIPO_ORDER.filter((t) => t !== tipoInicial)] : CONTACTO_TIPO_ORDER),
    [tipoInicial],
  )

  /**
   * Proveedores que ya existen en MCM pero que esta delegación no usa. Es la
   * pieza que evita los duplicados: se ofrece el original justo en el momento
   * en el que ibas a crear el tuyo.
   */
  const catalogo = useMemo(
    () =>
      tipoFiltro === "todos" || tipoFiltro === "proveedor"
        ? contactos.filter((c) => c.en_catalogo && !adoptadosAhora.includes(c.id) && coincide(c, palabras))
        : [],
    [contactos, adoptadosAhora, palabras, tipoFiltro],
  )

  const hayResultados = CONTACTO_TIPO_ORDER.some((t) => grouped[t].length > 0) || catalogo.length > 0
  // Un vacío por culpa del filtro dice dónde sí está lo que se busca.
  const otrosTiposConResultados =
    tipoFiltro === "todos"
      ? []
      : CONTACTO_TIPO_ORDER.filter((t) => t !== tipoFiltro && conteoPorTipo[t] > 0).sort(
          (a, b) => conteoPorTipo[b] - conteoPorTipo[a],
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
    // Modal a propósito. Este selector se abre casi siempre dentro de un diálogo
    // o un panel lateral, y el bloqueo de scroll de ese diálogo se come la rueda
    // y el dedo en todo lo que se portalea fuera de él: la lista no se movía.
    // Siendo modal, el popover pasa a ser la capa de arriba y trae su propio
    // bloqueo, que sí deja desplazar su contenido.
    <Popover open={open} onOpenChange={handleOpenChange} modal>
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar contacto…"
            value={search}
            onValueChange={setSearch}
          />
          {tiposPresentes.size > 1 && (
            <div
              role="group"
              aria-label="Filtrar por tipo de contacto"
              className="flex gap-1.5 overflow-x-auto border-b px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(["todos", ...CONTACTO_TIPO_ORDER.filter((t) => tiposPresentes.has(t))] as FiltroTipo[]).map((t) => {
                const activo = tipoFiltro === t
                const count = t === "todos" ? coincidentes.length : conteoPorTipo[t]
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setTipoFiltro(t)}
                    className={cn(
                      "toque inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      activo
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {t !== "todos" && (
                      <span className={cn("h-1.5 w-1.5 rounded-full", CONTACTO_TIPO_INFO[t].dotClass)} aria-hidden />
                    )}
                    {t === "todos" ? "Todos" : CONTACTO_TIPO_INFO[t].label}
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
          <CommandList>
            {!hayResultados && (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                {tipoFiltro === "todos"
                  ? "Sin resultados."
                  : `Ningún contacto de tipo ${CONTACTO_TIPO_INFO[tipoFiltro].label}${trimmedSearch ? ` con “${trimmedSearch}”` : ""}.`}
              </div>
            )}
            {!hayResultados && otrosTiposConResultados.length > 0 && (
              <CommandGroup>
                {otrosTiposConResultados.map((t) => (
                  <CommandItem key={t} value={`__ver__${t}`} onSelect={() => setTipoFiltro(t)}>
                    <span className={cn("mx-1.5 h-1.5 w-1.5 rounded-full", CONTACTO_TIPO_INFO[t].dotClass)} aria-hidden />
                    Ver {conteoPorTipo[t]} en {CONTACTO_TIPO_INFO[t].label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

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

            {ordenTipos.map((tipo) => {
              const items = grouped[tipo]
              if (items.length === 0) return null
              const info = CONTACTO_TIPO_INFO[tipo]
              return (
                <CommandGroup key={tipo} heading={info.label}>
                  {items.map((c) => {
                    const isSelected = c.id === value
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.id}
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
                      value={`__catalogo__${c.id}`}
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
                      onCreateNew(trimmedSearch, tipoFiltro === "todos" ? tipoInicial : tipoFiltro)
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
