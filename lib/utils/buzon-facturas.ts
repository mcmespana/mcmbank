/**
 * Dirección del buzón de facturas de una delegación.
 *
 * El buzón es uno solo (`facturas@…`) y la delegación va en la etiqueta:
 * `facturas+castellon@movimientoconsolacion.com`. Así se puede recibir de las
 * 18 delegaciones sin dar de alta 18 buzones ni tocar el DNS del dominio
 * principal (ver `docs/FACTURAS_EMAIL_IA.md`).
 */

const POR_DEFECTO = "facturas@movimientoconsolacion.com"

/** `null` si la delegación aún no tiene alias configurado. */
export function direccionBuzonFacturas(alias: string | null | undefined): string | null {
  const limpio = (alias ?? "").trim().toLowerCase()
  if (!limpio) return null

  const base = (process.env.NEXT_PUBLIC_FACTURAS_EMAIL || POR_DEFECTO).trim()
  const arroba = base.lastIndexOf("@")
  if (arroba <= 0) return null

  return `${base.slice(0, arroba)}+${limpio}@${base.slice(arroba + 1)}`
}
