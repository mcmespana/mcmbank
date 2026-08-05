import { generateEnableBankingJWT } from "./jwt"
import type {
  EBAspspInfo,
  EBBalancesResponse,
  EBCreateSessionRequest,
  EBSession,
  EBStartAuthRequest,
  EBStartAuthResponse,
  EBTransactionsResponse,
} from "./types"

export const EB_BASE_URL = "https://api.enablebanking.com"

const DEFAULT_PSU_HEADERS: Record<string, string> = {
  // Algunos ASPSPs exigen estos headers incluso en crons sin PSU real.
  "psu-ip-address": process.env.ENABLE_BANKING_PSU_IP || "127.0.0.1",
  "psu-user-agent":
    process.env.ENABLE_BANKING_PSU_UA ||
    "Mozilla/5.0 (compatible; MCMBank/1.0; +https://mcmbank.app)",
}

export class EnableBankingError extends Error {
  status: number
  body: unknown
  endpoint: string
  constructor(endpoint: string, status: number, body: unknown, message?: string) {
    super(message || `EnableBanking ${endpoint} → ${status}`)
    this.endpoint = endpoint
    this.status = status
    this.body = body
  }
}

type RequestOpts = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  psuHeaders?: boolean
  extraHeaders?: Record<string, string>
  signal?: AbortSignal
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { token } = generateEnableBankingJWT()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(opts.psuHeaders !== false ? DEFAULT_PSU_HEADERS : {}),
    ...(opts.extraHeaders || {}),
  }

  const res = await fetch(`${EB_BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (!res.ok) {
    throw new EnableBankingError(path, res.status, parsed, `EnableBanking ${path} → ${res.status}`)
  }
  return parsed as T
}

export const enableBanking = {
  async getApplication(): Promise<unknown> {
    return request("/application")
  },

  async listAspsps(country?: string): Promise<{ aspsps: EBAspspInfo[] }> {
    const qs = country ? `?country=${encodeURIComponent(country)}` : ""
    return request(`/aspsps${qs}`)
  },

  async startAuth(body: EBStartAuthRequest): Promise<EBStartAuthResponse> {
    return request("/auth", { method: "POST", body })
  },

  async createSession(body: EBCreateSessionRequest): Promise<EBSession> {
    return request("/sessions", { method: "POST", body })
  },

  async getSession(sessionId: string): Promise<EBSession> {
    return request(`/sessions/${encodeURIComponent(sessionId)}`)
  },

  async revokeSession(sessionId: string): Promise<unknown> {
    return request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" })
  },

  async getBalances(accountUid: string): Promise<EBBalancesResponse> {
    return request(`/accounts/${encodeURIComponent(accountUid)}/balances`)
  },

  async getTransactions(
    accountUid: string,
    params: {
      date_from?: string
      date_to?: string
      continuation_key?: string
      transaction_status?: "BOOK" | "PDNG" | "INFO"
      strategy?: string
    } = {},
  ): Promise<EBTransactionsResponse> {
    const qs = new URLSearchParams()
    if (params.date_from) qs.set("date_from", params.date_from)
    if (params.date_to) qs.set("date_to", params.date_to)
    if (params.continuation_key) qs.set("continuation_key", params.continuation_key)
    if (params.transaction_status) qs.set("transaction_status", params.transaction_status)
    if (params.strategy) qs.set("strategy", params.strategy)
    const suffix = qs.toString() ? `?${qs}` : ""
    return request(`/accounts/${encodeURIComponent(accountUid)}/transactions${suffix}`)
  },

  /**
   * Pagina todas las transacciones usando continuation_key. Limita a
   * `maxPages` para no bloquear el worker indefinidamente en cuentas con
   * históricos enormes.
   */
  async getAllTransactions(
    accountUid: string,
    params: { date_from?: string; date_to?: string; transaction_status?: "BOOK" | "PDNG" | "INFO" } = {},
    opts: { maxPages?: number; onPage?: (page: EBTransactionsResponse, index: number) => void } = {},
  ): Promise<{ pages: EBTransactionsResponse[]; truncated: boolean }> {
    const maxPages = opts.maxPages ?? 50
    const pages: EBTransactionsResponse[] = []
    let continuation_key: string | undefined
    let truncated = false
    for (let i = 0; i < maxPages; i++) {
      const page = await this.getTransactions(accountUid, { ...params, continuation_key })
      pages.push(page)
      opts.onPage?.(page, i)
      if (!page.continuation_key) {
        continuation_key = undefined
        break
      }
      continuation_key = page.continuation_key
      // Salimos del bucle por agotar maxPages, no porque el banco haya
      // terminado — el banco todavía tenía continuation_key. Esto se debe
      // reportar, nunca descartar en silencio (ver plan 007).
      if (i === maxPages - 1) truncated = true
    }
    return { pages, truncated }
  },
}
