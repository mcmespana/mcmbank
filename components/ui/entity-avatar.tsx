"use client"

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
 *   1. Si `icon` está, se pinta el icono.
 *   2. Si hay emoji personalizado por el usuario, se pinta el emoji.
 *   3. Si no, iniciales.
 *
 * El color sale de `colorHex` si está, si no de una paleta estable
 * derivada del nombre. Mucho más sobrio que un emoji enorme.
 */
export function EntityAvatar({
  name,
  emoji,
  defaultEmojis,
  colorHex,
  icon: Icon,
  size = "md",
  ringed = false,
  className,
  seed,
}: EntityAvatarProps) {
  const palette: AvatarPalette = getPaletteFromString(seed ?? name ?? "")
  const showEmoji = !Icon && isCustomEmoji(emoji, [...(defaultEmojis ?? [])])
  const initials = getInitials(name)

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
        !colorHex && palette.bg,
        !colorHex && palette.text,
        ringed && "ring-1",
        ringed && (colorHex ? "ring-current/20" : palette.ring),
        SIZE_CLASSES[size],
        className,
      )}
      style={inlineStyle}
      aria-hidden
    >
      {Icon ? (
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
