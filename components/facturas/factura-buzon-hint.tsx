"use client"

import { useState } from "react"
import { Check, Copy, Mail } from "lucide-react"
import { direccionBuzonFacturas } from "@/lib/utils/buzon-facturas"

interface FacturaBuzonHintProps {
  aliasEmail: string | null | undefined
  delegacionNombre?: string | null
}

/**
 * "Manda las facturas a esta dirección y aparecen aquí solas."
 *
 * Es la única pista de que el buzón existe, así que va donde se mira cuando se
 * está subiendo facturas a mano: justo debajo de la bandeja.
 */
export function FacturaBuzonHint({ aliasEmail, delegacionNombre }: FacturaBuzonHintProps) {
  const [copiado, setCopiado] = useState(false)
  const direccion = direccionBuzonFacturas(aliasEmail)

  if (!direccion) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(direccion)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin portapapeles (contexto no seguro): la dirección está a la vista.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
        También puedes reenviar las facturas
        {delegacionNombre ? ` de ${delegacionNombre}` : ""} a
      </span>
      <button
        type="button"
        onClick={copiar}
        title="Copiar la dirección"
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-border hover:bg-muted"
      >
        {direccion}
        {copiado ? (
          <Check className="h-3 w-3 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-3 w-3 opacity-60" aria-hidden />
        )}
      </button>
    </div>
  )
}
