"use client"

import { useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"

interface ContactoLogoFieldProps {
  /** Null mientras el contacto no existe: sin id no hay dónde guardar el logo. */
  contactoId: string | null
  nombre: string
  emoji?: string | null
  color?: string | null
  logoUrl: string | null
  dominio: string
  onDominioChange: (dominio: string) => void
  onLogoChange: (logoUrl: string | null) => void
}

/**
 * Logo del proveedor: se busca solo en su web, o se sube a mano.
 *
 * Mientras el contacto no está creado no hay id contra el que guardar, así que
 * solo se pide la web; el logo se busca automáticamente en cuanto se guarda.
 */
export function ContactoLogoField({
  contactoId,
  nombre,
  emoji,
  color,
  logoUrl,
  dominio,
  onDominioChange,
  onLogoChange,
}: ContactoLogoFieldProps) {
  const [buscando, setBuscando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const ocupado = buscando || subiendo

  const buscarLogo = async () => {
    if (!contactoId) return
    setBuscando(true)
    try {
      const respuesta = await fetch(`/api/contactos/${contactoId}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dominio: dominio.trim() || null, forzar: true }),
      })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        toast.error(datos?.error ?? "No se pudo buscar el logo")
        return
      }

      onLogoChange(datos.logoUrl ?? null)
      if (datos.dominio) onDominioChange(datos.dominio)
      toast.success("Logo encontrado")
    } catch (error) {
      console.error("Error buscando el logo:", error)
      toast.error("No se pudo buscar el logo")
    } finally {
      setBuscando(false)
    }
  }

  const subirLogo = async (archivo: File) => {
    if (!contactoId) return
    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append("archivo", archivo)

      const respuesta = await fetch(`/api/contactos/${contactoId}/logo`, { method: "PUT", body: formData })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        toast.error(datos?.error ?? "No se pudo subir el logo")
        return
      }

      onLogoChange(datos.logoUrl ?? null)
      toast.success("Logo subido")
    } catch (error) {
      console.error("Error subiendo el logo:", error)
      toast.error("No se pudo subir el logo")
    } finally {
      setSubiendo(false)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ""
    }
  }

  const quitarLogo = async () => {
    if (!contactoId) return
    setSubiendo(true)
    try {
      const respuesta = await fetch(`/api/contactos/${contactoId}/logo`, { method: "DELETE" })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null)
        toast.error(datos?.error ?? "No se pudo quitar el logo")
        return
      }
      onLogoChange(null)
      toast.success("Logo quitado")
    } catch (error) {
      console.error("Error quitando el logo:", error)
      toast.error("No se pudo quitar el logo")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <EntityAvatar
          name={nombre || "Proveedor"}
          emoji={emoji}
          defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
          colorHex={color}
          logoUrl={logoUrl}
          size="lg"
          className="h-12 w-12 text-sm"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="contacto-dominio" className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            Logo y web
          </Label>
          <Input
            id="contacto-dominio"
            value={dominio}
            onChange={(e) => onDominioChange(e.target.value)}
            placeholder="mercadona.es"
            inputMode="url"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            {contactoId
              ? "El logo se saca de la web del proveedor. Si no la escribes, se intenta adivinar por el nombre."
              : "Al guardar se buscará el logo automáticamente. Escribe la web si el nombre no basta para encontrarla."}
          </p>
        </div>
      </div>

      {contactoId && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={buscarLogo} disabled={ocupado}>
            {buscando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {logoUrl ? "Buscar otro" : "Buscar logo"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputArchivoRef.current?.click()}
            disabled={ocupado}
          >
            {subiendo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Subir el mío
          </Button>

          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={quitarLogo}
              disabled={ocupado}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Quitar
            </Button>
          )}

          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/x-icon"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) void subirLogo(archivo)
            }}
          />
        </div>
      )}
    </div>
  )
}
