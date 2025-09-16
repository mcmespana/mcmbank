import type { Categoria } from "@/lib/types/database"

interface RgbColor {
  r: number
  g: number
  b: number
}

interface CategoryColorTokens {
  color: string
  textColor: string
  rgbValue: string
}

const FALLBACK_COLOR = "#6366f1"

const HEX_COLOR_REGEX = /^#?([\da-f]{3}|[\da-f]{6})$/i
const RGB_COLOR_REGEX =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|0?\.\d+|1(?:\.0+)?))?\s*\)$/i

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  ingreso: "#10b981",
  gasto: "#ef4444",
}

function expandShorthandHex(hex: string) {
  return hex
    .split("")
    .map((char) => char + char)
    .join("")
}

function parseHexColor(color: string): RgbColor | null {
  const match = color.trim().match(HEX_COLOR_REGEX)
  if (!match) return null

  const hex = match[1]
  const normalized = hex.length === 3 ? expandShorthandHex(hex) : hex
  const value = parseInt(normalized, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function parseRgbColor(color: string): RgbColor | null {
  const match = color.trim().match(RGB_COLOR_REGEX)
  if (!match) return null

  const [, r, g, b] = match

  return {
    r: Math.min(255, Number.parseInt(r, 10)),
    g: Math.min(255, Number.parseInt(g, 10)),
    b: Math.min(255, Number.parseInt(b, 10)),
  }
}

function parseColor(color: string): RgbColor | null {
  return parseHexColor(color) ?? parseRgbColor(color)
}

function relativeLuminance({ r, g, b }: RgbColor) {
  const srgb = [r, g, b].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  const [rl, gl, bl] = srgb
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

export function resolveCategoryColor(category: Pick<Categoria, "color" | "tipo">) {
  if (category.color && category.color.trim() !== "") {
    return category.color
  }

  if (category.tipo && DEFAULT_CATEGORY_COLORS[category.tipo]) {
    return DEFAULT_CATEGORY_COLORS[category.tipo]
  }

  return FALLBACK_COLOR
}

export function getReadableTextColor(color: string, contrastThreshold = 0.55) {
  const rgb = parseColor(color)
  if (!rgb) {
    return "#0f172a"
  }

  const luminance = relativeLuminance(rgb)
  return luminance > contrastThreshold ? "#0f172a" : "#f8fafc"
}

function formatRgbValue(rgb: RgbColor) {
  return `${rgb.r} ${rgb.g} ${rgb.b}`
}

export function getCategoryColorTokens(
  category: Pick<Categoria, "color" | "tipo">
): CategoryColorTokens {
  const color = resolveCategoryColor(category)
  const parsedColor = parseColor(color)
  const fallbackRgb = parseHexColor(FALLBACK_COLOR)!

  return {
    color,
    textColor: getReadableTextColor(color),
    rgbValue: formatRgbValue(parsedColor ?? fallbackRgb),
  }
}

export type { CategoryColorTokens }
