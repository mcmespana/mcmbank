import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type EnableBankingTransaction = {
  entry_reference?: string
  transaction_id?: string
  transaction_amount?: { amount: string; currency: string }
  credit_debit_indicator?: "CRDT" | "DBIT" | string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  remittance_information?: string[]
  reference_number?: string
  debtor?: { name?: string }
  creditor?: { name?: string }
}

const ENABLEBANKING_BASE_URL = Deno.env.get("ENABLEBANKING_API_BASE_URL") || "https://api.enablebanking.com"

const base64Url = (value: string) =>
  btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const createJwt = async () => {
  const appId = Deno.env.get("ENABLEBANKING_APP_ID")
  const privateKey = Deno.env.get("ENABLEBANKING_PRIVATE_KEY")?.replace(/\\n/g, "\n")

  if (!appId || !privateKey) {
    throw new Error("Missing Enable Banking credentials")
  }

  const header = { typ: "JWT", alg: "RS256", kid: appId }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 600,
  }
  const encoder = new TextEncoder()
  const data = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(data))
  const signatureBase64 = base64Url(String.fromCharCode(...new Uint8Array(signature)))
  return `${data}.${signatureBase64}`
}

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const enableBankingFetch = async (path: string, options: RequestInit = {}) => {
  const jwt = await createJwt()
  const response = await fetch(`${ENABLEBANKING_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`EnableBanking error ${response.status}: ${text}`)
  }

  return response.json()
}

const getTransactions = async (accountId: string, dateFrom?: string, dateTo?: string) => {
  const params = new URLSearchParams()
  if (dateFrom) params.set("date_from", dateFrom)
  if (dateTo) params.set("date_to", dateTo)

  let continuation: string | null = null
  const items: EnableBankingTransaction[] = []

  do {
    if (continuation) params.set("continuation_key", continuation)
    const data = await enableBankingFetch(`/accounts/${accountId}/transactions?${params.toString()}`)
    items.push(...(data?.transactions || []))
    continuation = data?.continuation_key || null
  } while (continuation)

  return items
}

const toMovimiento = (trx: EnableBankingTransaction, cuentaId: string, delegacionId: string, createdBy: string) => {
  const amount = Number(trx.transaction_amount?.amount || 0)
  const indicator = trx.credit_debit_indicator === "DBIT" ? -1 : 1
  const signedAmount = amount * indicator
  const fecha = trx.booking_date || trx.value_date || trx.transaction_date || new Date().toISOString().slice(0, 10)
  const conceptParts = trx.remittance_information?.length ? trx.remittance_information : []
  const concepto = conceptParts.join(" ").trim() || trx.reference_number || "Movimiento Enable Banking"
  const contraparte = trx.credit_debit_indicator === "DBIT" ? trx.creditor?.name : trx.debtor?.name
  const externalId = trx.entry_reference || trx.transaction_id || `${fecha}:${signedAmount}:${concepto}`

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
    external_id: externalId,
    external_raw: trx,
  }
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing Supabase credentials", { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: links, error } = await supabase
    .from("enablebanking_link")
    .select("id, cuenta_id, enablebanking_account_id, sync_start_date, last_sync_at, enablebanking_account:enablebanking_account_id (provider_account_id)")
    .eq("status", "active")

  if (error) {
    return new Response(`Error fetching links: ${error.message}`, { status: 500 })
  }

  const systemUserId = Deno.env.get("ENABLEBANKING_SYSTEM_USER_ID") ||
    "00000000-0000-0000-0000-000000000000"

  for (const link of links || []) {
    const { data: cuenta } = await supabase.from("cuenta").select("id, delegacion_id").eq("id", link.cuenta_id).single()
    if (!cuenta) continue

    const accountId = link.enablebanking_account?.provider_account_id
    if (!accountId) continue

    const dateFrom = link.sync_start_date || link.last_sync_at?.slice(0, 10)
    const dateTo = new Date().toISOString().slice(0, 10)
    const transactions = await getTransactions(accountId, dateFrom || undefined, dateTo)

    for (const trx of transactions) {
      const movimiento = toMovimiento(trx, cuenta.id, cuenta.delegacion_id, systemUserId)
      const { error: insertError } = await supabase.from("movimiento").insert([movimiento])
      if (insertError && insertError.code !== "23505") {
        console.error("Insert error", insertError)
      }
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
  }

  return new Response("ok", { status: 200 })
})
