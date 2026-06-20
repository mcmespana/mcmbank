"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, Copy, Globe, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "@/components/ui/color-picker"
import { EmojiPickerButton } from "@/components/ui/emoji-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { CONTACTO_TIPO_INFO, CONTACTO_TIPO_ORDER, getDefaultColor, getDefaultEmoji } from "@/lib/utils/contacto-tipos"
import { formatearIban, normalizarIban, validarIban } from "@/lib/utils/iban"
import { useClipboard } from "@/hooks/use-clipboard"
import type {
  Categoria,
  Contacto,
  ContactoConCategoriaPredeterminada,
  ContactoInsert,
  ContactoTipo,
  ContactoUpdate,
} from "@/lib/types/database"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ContactoFormSubmitPayload {
  insert?: Omit<ContactoInsert, "creado_en" | "actualizado_en">
  update?: ContactoUpdate
  esGlobal: boolean
}

interface ContactoFormProps {
  delegacionId: string | null
  contacto?: ContactoConCategoriaPredeterminada | null
  categorias: Pick<Categoria, "id" | "nombre" | "emoji" | "color">[]
  canManageGlobal: boolean
  defaultTipo?: ContactoTipo
  defaultNombre?: string
  onSubmit: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onCancel: () => void
  onSaved?: (contacto: Contacto | void) => void
}

export function ContactoForm({
  delegacionId,
  contacto,
  categorias,
  canManageGlobal,
  defaultTipo = "proveedor",
  defaultNombre,
  onSubmit,
  onCancel,
  onSaved,
}: ContactoFormProps) {
  const isEdit = Boolean(contacto?.id)
  const { copy, isCopied } = useClipboard()

  const [tipo, setTipo] = useState<ContactoTipo>(contacto?.tipo ?? defaultTipo)
  const [nombre, setNombre] = useState(contacto?.nombre ?? defaultNombre ?? "")
  const [esGlobal, setEsGlobal] = useState<boolean>(Boolean(contacto?.es_global))
  const [emoji, setEmoji] = useState<string>(contacto?.emoji ?? getDefaultEmoji(contacto?.tipo ?? defaultTipo))
  const [color, setColor] = useState<string>(contacto?.color ?? getDefaultColor(contacto?.tipo ?? defaultTipo))
  const [identificadorFiscal, setIdentificadorFiscal] = useState(contacto?.identificador_fiscal ?? "")
  const [iban, setIban] = useState(contacto?.iban ? formatearIban(contacto.iban) : "")
  const [email, setEmail] = useState(contacto?.email ?? "")
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "")
  const [direccion, setDireccion] = useState(contacto?.direccion ?? "")
  const [ciudad, setCiudad] = useState(contacto?.ciudad ?? "")
  const [codigoPostal, setCodigoPostal] = useState(contacto?.codigo_postal ?? "")
  const [categoriaPredeterminadaId, setCategoriaPredeterminadaId] = useState<string | "ninguna">(
    contacto?.categoria_id_predeterminada ?? "ninguna",
  )
  const [notas, setNotas] = useState(contacto?.notas ?? "")
  const [direccionAbierta, setDireccionAbierta] = useState(Boolean(contacto?.direccion || contacto?.ciudad || contacto?.codigo_postal))
  const [loading, setLoading] = useState(false)

  const ibanNormalizado = useMemo(() => normalizarIban(iban), [iban])
  const ibanValido = useMemo(() => validarIban(iban), [iban])

  useEffect(() => {
    if (isEdit) return
    setEmoji(getDefaultEmoji(tipo))
    setColor(getDefaultColor(tipo))
  }, [tipo, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (email && !EMAIL_REGEX.test(email.trim())) {
      toast.error("El email no parece válido")
      return
    }
    if (!ibanValido) {
      toast.error("El IBAN no parece válido. Revísalo o déjalo vacío.")
      return
    }
    if (!esGlobal && !delegacionId) {
      toast.error("Selecciona una delegación antes de guardar un contacto local")
      return
    }

    setLoading(true)
    try {
      const baseFields = {
        tipo,
        nombre: nombreTrim,
        emoji: emoji || null,
        color: color || null,
        identificador_fiscal: identificadorFiscal.trim() || null,
        iban: ibanNormalizado || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        ciudad: ciudad.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        categoria_id_predeterminada: categoriaPredeterminadaId === "ninguna" ? null : categoriaPredeterminadaId,
        notas: notas.trim() || null,
      }

      let result: Contacto | void
      if (isEdit && contacto) {
        result = (await onSubmit({
          esGlobal,
          update: {
            ...baseFields,
            es_global: esGlobal,
            delegacion_id: esGlobal ? null : (delegacionId as string),
          },
        })) as Contacto | void
      } else {
        result = (await onSubmit({
          esGlobal,
          insert: {
            ...baseFields,
            es_global: esGlobal,
            delegacion_id: esGlobal ? null : (delegacionId as string),
          },
        })) as Contacto | void
      }
      toast.success(isEdit ? "Contacto actualizado" : "Contacto creado")
      onSaved?.(result)
    } catch (err) {
      console.error("Error guardando contacto:", err)
      toast.error("No se pudo guardar el contacto: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
      {/* Selector de tipo */}
      <div className="space-y-2">
        <Label>Tipo de contacto *</Label>
        <div className="grid grid-cols-3 gap-2">
          {CONTACTO_TIPO_ORDER.map((t) => {
            const info = CONTACTO_TIPO_INFO[t]
            const isSelected = tipo === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all h-full",
                  isSelected
                    ? `${info.bgClass} ${info.borderClass} shadow-md`
                    : "border-border/40 bg-card hover:border-border",
                )}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <info.icon className={cn("h-3.5 w-3.5", isSelected ? info.textClass : "text-muted-foreground")} aria-hidden />
                  <span className={cn("leading-tight tracking-tight", isSelected && info.textClass)}>{info.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{info.descripcion}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Contacto global (solo gestores centrales) */}
      {canManageGlobal && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox checked={esGlobal} onCheckedChange={(v) => setEsGlobal(Boolean(v))} />
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Contacto global (todas las delegaciones)</span>
        </label>
      )}

      {/* Identidad */}
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="contacto-nombre">Nombre *</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="contacto-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === "proveedor" ? "Mercadona, Luz García SL…" : tipo === "persona_mcm" ? "Juan Pérez" : "Familia López"}
              required
              autoFocus
              className="flex-1"
            />
            <EmojiPickerButton value={emoji} onChange={setEmoji} size="sm" />
            <ColorPicker value={color} onChange={setColor} className="h-8 w-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contacto-id-fiscal">CIF / NIF / DNI</Label>
          <Input
            id="contacto-id-fiscal"
            value={identificadorFiscal}
            onChange={(e) => setIdentificadorFiscal(e.target.value)}
            placeholder="B12345678 · 12345678X"
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="contacto-iban">IBAN</Label>
          <div className="flex gap-2">
            <Input
              id="contacto-iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              onBlur={() => setIban(formatearIban(iban))}
              placeholder="ES91 2100 0418 4502 0005 1332"
              className={cn(!ibanValido && "border-red-500 focus-visible:ring-red-500/30")}
            />
            {ibanNormalizado && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copy(ibanNormalizado)}
                title="Copiar IBAN"
              >
                <Copy className={cn("h-4 w-4", isCopied(ibanNormalizado) && "text-green-600")} />
              </Button>
            )}
          </div>
          {iban && !ibanValido && (
            <p className="text-[11px] text-red-600">El dígito de control no cuadra. Revísalo o déjalo vacío.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contacto-email">Mail</Label>
          <div className="flex gap-2">
            <Input
              id="contacto-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hola@ejemplo.com"
            />
            {email && (
              <Button type="button" variant="outline" size="icon" onClick={() => copy(email.trim())} title="Copiar email">
                <Copy className={cn("h-4 w-4", isCopied(email.trim()) && "text-green-600")} />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contacto-telefono">Teléfono</Label>
          <div className="flex gap-2">
            <Input
              id="contacto-telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
            />
            {telefono && (
              <Button type="button" variant="outline" size="icon" onClick={() => copy(telefono.trim())} title="Copiar teléfono">
                <Copy className={cn("h-4 w-4", isCopied(telefono.trim()) && "text-green-600")} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dirección colapsable */}
      <div className="rounded-xl border border-border/40 bg-card/40">
        <button
          type="button"
          onClick={() => setDireccionAbierta((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/40 transition-colors"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" /> Dirección postal (opcional)
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", direccionAbierta && "rotate-180")} />
        </button>
        {direccionAbierta && (
          <div className="space-y-3 px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="contacto-direccion">Dirección</Label>
              <Input
                id="contacto-direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, piso…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contacto-ciudad">Ciudad</Label>
                <Input
                  id="contacto-ciudad"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto-cp">Código postal</Label>
                <Input
                  id="contacto-cp"
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Categoría predeterminada */}
      <div className="space-y-1.5">
        <Label>Categoría sugerida (opcional)</Label>
        <Select
          value={categoriaPredeterminadaId}
          onValueChange={(v) => setCategoriaPredeterminadaId(v as string | "ninguna")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Ninguna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguna">Ninguna</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="inline-flex items-center gap-2">
                  <span>{cat.emoji ?? "🏷️"}</span>
                  <span>{cat.nombre}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Se sugerirá automáticamente al crear un movimiento vinculado a este contacto.
        </p>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="contacto-notas">Notas</Label>
        <Textarea
          id="contacto-notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Cualquier detalle útil sobre este contacto"
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Guardando…" : isEdit ? "Actualizar contacto" : "Crear contacto"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
