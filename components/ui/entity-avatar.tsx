"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials, getPaletteFromString, isCustomEmoji, type AvatarPalette } from "@/lib/utils/avatar"

interface EntityAvatarProps {
  name: string | null | undefined
  /** Emoji elegido manualmente por el usuario. Si coincide con alguno de
   *  `defaultEmojis` se ignora y se muestran iniciales. */
  emoji?: string | null
  defaultEmojis?: readonly string[]
  /** Color hex personalizado. Si está, prevalece sobre el de la paleta. */
  colorHex?: string | null
  /** Logo del proveedor. Manda sobre emoji e iniciales; si falla al cargar, se
   *  cae con elegancia a lo que se habría pintado sin él. */
  logoUrl?: string | null
  /** Si se pasa, se usa este icono en lugar de las iniciales (override). */
  icon?: LucideIcon
  size?: "sm" | "md" | "lg"
  /** Aro/ring sutil alrededor del avatar. */
  ringed?: boolean
  className?: string
  /** Hash determinista para mapear a paleta. Por defecto se calcula con `name`. */
  seed?: string | null
}

const SIZE_CLASSES: Record<NonNullable<EntityAvatarProps["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
}

const ICON_SIZES: Record<NonNullable<EntityAvatarProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

/**
 * Avatar coherente para contactos, contactos en pagos, etc.
 * Jerarquía de contenido:
 *   1. Si hay `logoUrl` y la imagen carga, se pinta el logo.
 *   2. Si `icon` está, se pinta el icono.
 *   3. Si hay emoji personalizado por el usuario, se pinta el emoji.
 *   4. Si no, iniciales.
 *
 * El color sale de `colorHex` si está, si no de una paleta estable
 * derivada del nombre. Mucho más sobrio que un emoji enorme.
 */
export function EntityAvatar({
  name,
  emoji,
  defaultEmojis,
  colorHex,
  logoUrl,
  icon: Icon,
  size = "md",
  ringed = false,
  className,
  seed,
}: EntityAvatarProps) {
  const palette: AvatarPalette = getPaletteFromString(seed ?? name ?? "")
  const showEmoji = !Icon && isCustomEmoji(emoji, [...(defaultEmojis ?? [])])
  const initials = getInitials(name)

  // Un logo que da error (borrado del bucket, red caída) no debe dejar un hueco:
  // se recuerda el fallo y se pinta el avatar de siempre. El estado se resetea
  // durante el render al cambiar de logo, sin efecto, igual que en BankAvatar.
  const [logoRoto, setLogoRoto] = useState(false)
  const [logoPrevio, setLogoPrevio] = useState(logoUrl)
  if (logoUrl !== logoPrevio) {
    setLogoPrevio(logoUrl)
    setLogoRoto(false)
  }

  const mostrarLogo = Boolean(logoUrl) && !logoRoto

  const inlineStyle = colorHex
    ? {
        backgroundColor: `${colorHex}1A`, // ~10% alpha
        color: colorHex,
      }
    : undefined

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-semibold tracking-tight",
        // Con logo, el fondo es blanco: los logotipos se diseñan sobre blanco y
        // un tinte de color por detrás los ensucia.
        mostrarLogo ? "overflow-hidden bg-white ring-1 ring-border/60 dark:bg-white" : !colorHex && palette.bg,
        !mostrarLogo && !colorHex && palette.text,
        ringed && "ring-1",
        ringed && !mostrarLogo && (colorHex ? "ring-current/20" : palette.ring),
        SIZE_CLASSES[size],
        className,
      )}
      style={mostrarLogo ? undefined : inlineStyle}
      aria-hidden
    >
      {mostrarLogo ? (
        <img
          src={logoUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setLogoRoto(true)}
          className="h-full w-full object-contain p-0.5"
        />
      ) : Icon ? (
        <Icon className={ICON_SIZES[size]} />
      ) : showEmoji ? (
        <span className="leading-none" style={{ fontSize: size === "lg" ? "1.05rem" : size === "md" ? "0.95rem" : "0.8rem" }}>
          {emoji}
        </span>
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
