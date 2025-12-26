import crypto from "crypto"
import type { EnableBankingTransaction } from "@/lib/services/enablebanking-api"
import { getAccountTransactions } from "@/lib/services/enablebanking-api"
import { createAdminClient } from "@/lib/supabase/admin"

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const buildExternalId = (trx: EnableBankingTransaction) => {
  if (trx.entry_reference) return trx.entry_reference
  if (trx.transaction_id) return trx.transaction_id
  const hash = crypto.createHash("sha256")
  hash.update(
    `${trx.booking_date || trx.value_date || trx.transaction_date || ""}|${trx.transaction_amount?.amount || ""}|${
      trx.remittance_information?.join(" ") || trx.reference_number || ""
    }`,
  )
  return hash.digest("hex")
}

const mapTransaction = (
  trx: EnableBankingTransaction,
  cuentaId: string,
  delegacionId: string,
  createdBy: string,
) => {
  const amount = Number(trx.transaction_amount?.amount || 0)
  const indicator = trx.credit_debit_indicator === "DBIT" ? -1 : 1
  const signedAmount = amount * indicator
  const fecha = trx.booking_date || trx.value_date || trx.transaction_date || formatDate(new Date())
  const concepto =
    trx.remittance_information?.join(" ").trim() || trx.reference_number || "Movimiento Enable Banking"
  const contraparte = trx.credit_debit_indicator === "DBIT" ? trx.creditor?.name : trx.debtor?.name

  return {
    cuenta_id: cuentaId,
    delegacion_id: delegacionId,
    fecha,
    concepto,
    descripcion: trx.reference_number || null,
    contraparte: contraparte || null,
    importe: signedAmount,
    ignorado: false,
    creado_por: createdBy,
    source: "enablebanking",
    external_id: buildExternalId(trx),
    external_raw: trx,
  }
}

export const syncEnableBankingLink = async (params: {
  linkId?: string
  systemUserId: string
}) => {
  const supabase = createAdminClient()
  const linkQuery = supabase
    .from("enablebanking_link")
    .select(
      "id, cuenta_id, enablebanking_account_id, sync_start_date, last_sync_at, enablebanking_account:enablebanking_account_id (provider_account_id)",
    )
    .eq("status", "active")

  if (params.linkId) {
    linkQuery.eq("id", params.linkId)
  }

  const { data: links, error } = await linkQuery
  if (error) {
    throw new Error(error.message)
  }

  const results = []
  for (const link of links || []) {
    const { data: cuenta } = await supabase
      .from("cuenta")
      .select("id, delegacion_id")
      .eq("id", link.cuenta_id)
      .single()

    if (!cuenta) {
      results.push({ linkId: link.id, inserted: 0, skipped: 0, error: "Cuenta no encontrada" })
      continue
    }

    const accountId = link.enablebanking_account?.provider_account_id
    if (!accountId) {
      results.push({ linkId: link.id, inserted: 0, skipped: 0, error: "Cuenta Enable Banking inválida" })
      continue
    }

    const dateFrom = link.sync_start_date || link.last_sync_at?.slice(0, 10)
    const dateTo = formatDate(new Date())
    const transactions = await getAccountTransactions({
      accountId,
      dateFrom: dateFrom || undefined,
      dateTo,
    })

    let inserted = 0
    let skipped = 0

    for (const trx of transactions) {
      const movimiento = mapTransaction(trx, cuenta.id, cuenta.delegacion_id, params.systemUserId)
      const { error: insertError } = await supabase.from("movimiento").insert([movimiento])
      if (insertError) {
        if (insertError.code === "23505") {
          skipped += 1
          continue
        }
        throw insertError
      }
      inserted += 1
    }

    await supabase
      .from("enablebanking_link")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_from: dateFrom || dateTo,
        last_sync_to: dateTo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id)

    results.push({ linkId: link.id, inserted, skipped })
  }

  return results
}
