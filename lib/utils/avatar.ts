/**
 * Genera iniciales legibles a partir de un nombre.
 * - "María García" → "MG"
 * - "Asociación Hijas de la Caridad" → "AH"
 * - "Juan"  → "JU"
 * - "" / null → "·"
 */
export function getInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return "·"
  const palabras = trimmed
    .split(/\s+/)
    .filter((w) => w.length > 0)
    // Saltamos artículos/preposiciones cortas si hay más palabras detrás
    .filter((w, i, arr) => arr.length <= 2 || !STOP_WORDS.has(w.toLowerCase()))

  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase()
  }
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

const STOP_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "a", "al",
  "para", "por", "con", "sin", "san", "santa", "santo", "doña", "don",
])

/**
 * Hash determinista para mapear un string a un índice de paleta.
 * No criptográfico, solo estabilidad visual.
 */
function stableHash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export interface AvatarPalette {
  bg: string // tailwind utility for background
  text: string // tailwind utility for text
  ring: string // ring color when needed
  hex: string // hex color para casos donde necesitemos style inline
}

// Paleta sobria y coherente con el dashboard (variantes 50/600 para light,
// 950/40 con texto 300 para dark). Cubre buen contraste AA.
export const AVATAR_PALETTES: readonly AvatarPalette[] = [
  { bg: "bg-blue-50 dark:bg-blue-950/40",       text: "text-blue-700 dark:text-blue-300",       ring: "ring-blue-200/60 dark:ring-blue-900/60",       hex: "#2563EB" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200/60 dark:ring-emerald-900/60", hex: "#059669" },
  { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-200/60 dark:ring-amber-900/60",     hex: "#D97706" },
  { bg: "bg-violet-50 dark:bg-violet-950/40",   text: "text-violet-700 dark:text-violet-300",   ring: "ring-violet-200/60 dark:ring-violet-900/60",   hex: "#7C3AED" },
  { bg: "bg-rose-50 dark:bg-rose-950/40",       text: "text-rose-700 dark:text-rose-300",       ring: "ring-rose-200/60 dark:ring-rose-900/60",       hex: "#E11D48" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40",       text: "text-cyan-700 dark:text-cyan-300",       ring: "ring-cyan-200/60 dark:ring-cyan-900/60",       hex: "#0891B2" },
  { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-300", ring: "ring-fuchsia-200/60 dark:ring-fuchsia-900/60", hex: "#C026D3" },
  { bg: "bg-teal-50 dark:bg-teal-950/40",       text: "text-teal-700 dark:text-teal-300",       ring: "ring-teal-200/60 dark:ring-teal-900/60",       hex: "#0D9488" },
] as const

export function getPaletteFromString(value: string | null | undefined): AvatarPalette {
  const idx = stableHash(value ?? "") % AVATAR_PALETTES.length
  return AVATAR_PALETTES[idx]
}

/**
 * Devuelve si un emoji fue elegido manualmente por el usuario, descartando
 * los emojis "por defecto" del tipo de contacto/categoría.
 */
export function isCustomEmoji(emoji: string | null | undefined, defaults: string[] = []): boolean {
  if (!emoji) return false
  const e = emoji.trim()
  if (!e) return false
  return !defaults.includes(e)
}
