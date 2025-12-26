import crypto from "crypto"

const ENABLEBANKING_BASE_URL = process.env.ENABLEBANKING_API_BASE_URL || "https://api.enablebanking.com"

const base64Url = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const normalizePrivateKey = (key: string) => key.replace(/\\n/g, "\n")

export const createEnableBankingJwt = () => {
  const appId = process.env.ENABLEBANKING_APP_ID
  const privateKey = process.env.ENABLEBANKING_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error("Missing Enable Banking credentials")
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { typ: "JWT", alg: "RS256", kid: appId }
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 600,
  }

  const encodedHeader = base64Url(JSON.stringify(header))
  const encodedPayload = base64Url(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(data)
  const signature = signer.sign(normalizePrivateKey(privateKey), "base64url")
  return `${data}.${signature}`
}

export const enableBankingFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const jwt = createEnableBankingJwt()
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
    throw new Error(`Enable Banking error ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

export type EnableBankingAspsp = {
  name: string
  country: string
  bic?: string
  auth_methods?: { psu_type: string; approach: string; hidden_method: boolean }[]
  maximum_consent_validity?: number
}

export const listAspsps = async (query: {
  country?: string
  psu_type?: string
  service?: string
}) => {
  const params = new URLSearchParams()
  if (query.country) params.set("country", query.country)
  if (query.psu_type) params.set("psu_type", query.psu_type)
  if (query.service) params.set("service", query.service)
  const queryString = params.toString()
  return enableBankingFetch<{ aspsps: EnableBankingAspsp[] }>(
    `/aspsps${queryString ? `?${queryString}` : ""}`,
  )
}

export type StartAuthorizationRequest = {
  access: {
    valid_until: string
    balances?: boolean
    transactions?: boolean
  }
  aspsp: {
    name: string
    country: string
  }
  state: string
  redirect_url: string
  psu_type?: string
  auth_method?: string
  credentials?: Record<string, string>
  credentials_autosubmit?: boolean
  language?: string
  psu_id?: string
}

export type StartAuthorizationResponse = {
  url: string
  authorization_id: string
  psu_id_hash: string
}

export const startAuthorization = async (payload: StartAuthorizationRequest) =>
  enableBankingFetch<StartAuthorizationResponse>("/auth", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export type AuthorizeSessionResponse = {
  session_id: string
  accounts: Array<{
    uid?: string
    identification_hash?: string
    account_id?: { iban?: string }
    all_account_ids?: Array<{ scheme?: string; identification?: string }>
    name?: string
    currency?: string
    details?: string
  }>
  aspsp: EnableBankingAspsp
  psu_type: string
  access: Record<string, unknown>
}

export const authorizeSession = async (code: string) =>
  enableBankingFetch<AuthorizeSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  })

export type EnableBankingTransaction = {
  entry_reference?: string
  transaction_id?: string
  transaction_amount?: { amount: string; currency: string }
  credit_debit_indicator?: string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  remittance_information?: string[]
  reference_number?: string
  debtor?: { name?: string }
  creditor?: { name?: string }
}

export const getAccountTransactions = async (params: {
  accountId: string
  dateFrom?: string
  dateTo?: string
}) => {
  const query = new URLSearchParams()
  if (params.dateFrom) query.set("date_from", params.dateFrom)
  if (params.dateTo) query.set("date_to", params.dateTo)

  const items: EnableBankingTransaction[] = []
  let continuation: string | null = null

  do {
    if (continuation) {
      query.set("continuation_key", continuation)
    }
    const data = await enableBankingFetch<{ transactions: EnableBankingTransaction[]; continuation_key?: string }>(
      `/accounts/${params.accountId}/transactions?${query.toString()}`,
    )
    items.push(...(data.transactions || []))
    continuation = data.continuation_key || null
  } while (continuation)

  return items
}
