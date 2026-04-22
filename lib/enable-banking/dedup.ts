import crypto from "node:crypto"
import type { EBTransaction } from "./types"

export type ExternalIdSource = "transaction_id" | "entry_reference" | "composite_hash"

export type ResolvedExternalId = {
  external_id: string
  source: ExternalIdSource
}

/**
 * Estrategia de dedup en tres niveles, con prioridad:
 *   1. transaction_id         (lo que da el ASPSP si lo provee)
 *   2. entry_reference        (referencia única de la entrada contable)
 *   3. composite_hash         (fallback determinista sobre campos estables)
 *
 * El caso "5 pagos el mismo día, mismo importe" (p.ej. aportaciones mensuales)
 * se resuelve porque el hash compuesto incluye la contraparte (IBAN acreedor
 * o deudor) y el remittance_information completo, que típicamente difieren
 * entre pagos aunque el importe y la fecha coincidan.
 *
 * Cuando NI transaction_id NI entry_reference NI ningún campo diferenciador
 * existen (caso raro), el hash solo colisionará para pagos efectivamente
 * indistinguibles → que es exactamente lo que la tabla debería guardar una
 * vez. Si el banco realmente duplica la fila para reflejar varios pagos
 * idénticos sin metadatos, habrá que tratarlo con un contador intra-día,
 * pero prefiero no añadirlo hasta que veamos un caso real (YAGNI).
 */
export function resolveExternalId(tx: EBTransaction): ResolvedExternalId {
  if (tx.transaction_id && tx.transaction_id.trim() !== "") {
    return { external_id: `tid:${tx.transaction_id}`, source: "transaction_id" }
  }
  if (tx.entry_reference && tx.entry_reference.trim() !== "") {
    return { external_id: `eref:${tx.entry_reference}`, source: "entry_reference" }
  }

  const counterparty =
    tx.creditor_account?.iban ||
    tx.debtor_account?.iban ||
    tx.creditor_account?.bban ||
    tx.debtor_account?.bban ||
    tx.creditor_account?.other?.identification ||
    tx.debtor_account?.other?.identification ||
    tx.creditor?.name ||
    tx.debtor?.name ||
    ""

  const remittance = Array.isArray(tx.remittance_information)
    ? tx.remittance_information.join("|")
    : ""

  const parts = [
    tx.booking_date || "",
    tx.value_date || "",
    tx.transaction_date || "",
    tx.transaction_amount?.currency || "",
    tx.transaction_amount?.amount || "",
    tx.credit_debit_indicator || "",
    counterparty,
    remittance,
    tx.reference_number || "",
    tx.bank_transaction_code || "",
  ]
    .map((s) => s.toString().trim())
    .join("||")

  const hash = crypto.createHash("sha256").update(parts).digest("hex").slice(0, 32)
  return { external_id: `ch:${hash}`, source: "composite_hash" }
}

/**
 * Convierte una EBTransaction al shape que escribimos en la tabla movimiento.
 * No inserta en BD — solo transforma.
 */
export function mapTransactionToMovimiento(
  tx: EBTransaction,
  ctx: {
    cuenta_id: string
    delegacion_id: string
    creado_por: string
  },
): {
  cuenta_id: string
  delegacion_id: string
  fecha: string
  concepto: string
  descripcion: string | null
  contraparte: string | null
  importe: number
  booking_date: string | null
  value_date: string | null
  external_id: string
  external_id_source: ExternalIdSource
  origen_sync: "enablebanking"
  creado_por: string
} {
  const { external_id, source } = resolveExternalId(tx)

  const isDebit = tx.credit_debit_indicator === "DBIT"
  const rawAmount = parseFloat(tx.transaction_amount.amount)
  const importe = Number.isFinite(rawAmount) ? (isDebit ? -Math.abs(rawAmount) : Math.abs(rawAmount)) : 0

  const fecha =
    tx.booking_date || tx.value_date || tx.transaction_date || new Date().toISOString().slice(0, 10)

  const remittanceLines = Array.isArray(tx.remittance_information) ? tx.remittance_information : []
  const concepto =
    remittanceLines[0] ||
    tx.creditor?.name ||
    tx.debtor?.name ||
    tx.reference_number ||
    "Movimiento bancario"

  const descripcionParts = remittanceLines.slice(1).filter(Boolean)
  const descripcion = descripcionParts.length > 0 ? descripcionParts.join("\n") : null

  const contraparte =
    (isDebit ? tx.creditor?.name : tx.debtor?.name) ||
    tx.creditor?.name ||
    tx.debtor?.name ||
    null

  return {
    cuenta_id: ctx.cuenta_id,
    delegacion_id: ctx.delegacion_id,
    fecha,
    concepto: concepto.slice(0, 500),
    descripcion,
    contraparte,
    importe,
    booking_date: tx.booking_date || null,
    value_date: tx.value_date || null,
    external_id,
    external_id_source: source,
    origen_sync: "enablebanking" as const,
    creado_por: ctx.creado_por,
  }
}
