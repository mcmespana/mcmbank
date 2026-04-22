// Tipos de la API de Enable Banking (subset que usamos).
// Ref: https://enablebanking.com/docs/api/reference/

export type EBPsuType = "personal" | "business"

export type EBAccess = {
  valid_until: string // RFC3339
  accounts?: Array<{ iban?: string; bban?: string; other?: { identification: string } }>
  balances?: boolean
  transactions?: boolean
}

export type EBAspsp = { name: string; country: string }

export type EBStartAuthRequest = {
  access: EBAccess
  aspsp: EBAspsp
  state: string
  redirect_url: string
  psu_type: EBPsuType
  language?: string
  psu_id?: string
}

export type EBStartAuthResponse = {
  url: string
  authorization_id: string
  psu_id_hash?: string
}

export type EBCreateSessionRequest = { code: string }

export type EBAccountId = {
  iban?: string
  bban?: string
  other?: { identification: string; scheme_name?: string; issuer?: string }
}

export type EBAccountResource = {
  uid: string
  account_id: EBAccountId
  all_account_ids?: EBAccountId[]
  name?: string
  product?: string
  currency: string
  cash_account_type?: string
  identification_hash?: string
  identification_hashes?: string[]
}

export type EBSession = {
  session_id: string
  accounts: EBAccountResource[]
  aspsp: EBAspsp
  psu_type: EBPsuType
  access: EBAccess
}

export type EBAmount = { currency: string; amount: string }

export type EBAccountIdRef = EBAccountId

export type EBParty = { name?: string; postal_address?: unknown }

export type EBTransaction = {
  entry_reference?: string
  transaction_id?: string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  status: "BOOK" | "PDNG" | "INFO" | "OTHR"
  credit_debit_indicator: "CRDT" | "DBIT"
  transaction_amount: EBAmount
  creditor?: EBParty
  debtor?: EBParty
  creditor_account?: EBAccountIdRef
  debtor_account?: EBAccountIdRef
  remittance_information?: string[]
  reference_number?: string
  reference_number_schema?: string
  bank_transaction_code?: string
  [key: string]: unknown
}

export type EBTransactionsResponse = {
  transactions: EBTransaction[]
  continuation_key?: string
}

export type EBBalance = {
  name?: string
  balance_amount: EBAmount
  balance_type?: string
  reference_date?: string
  last_change_date_time?: string
}

export type EBBalancesResponse = { balances: EBBalance[] }

export type EBAspspInfo = {
  name: string
  country: string
  logo?: string
  psu_types: EBPsuType[]
  maximum_consent_validity: number // segundos
  required_psu_headers?: string[]
  auth_methods?: Array<{ name: string; title?: string; psu_type?: EBPsuType }>
  beta?: boolean
  sandbox?: Record<string, unknown> | null
  bic?: string
  group?: Record<string, unknown> | null
  payments?: unknown
}
