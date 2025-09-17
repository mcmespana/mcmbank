import { supabase } from "@/lib/supabase/client"
import { addMetric } from "@/lib/db/telemetry"

export interface RunQueryOptions<T> {
  label: string
  table?: string
  timeoutMs?: number
  build: (signal: AbortSignal) => Promise<{ data: T | null; error: any }>
  retryOnAuth?: boolean
  /** Optional external signal to propagate cancellation/timeouts */
  externalSignal?: AbortSignal | null
}

export async function runQuery<T>({
  label,
  table,
  timeoutMs = 15000,
  build,
  retryOnAuth = true,
  externalSignal,
}: RunQueryOptions<T>) {
  const started = Date.now()
  const ac = new AbortController()
  let removeExternalAbortListener: (() => void) | undefined

  if (externalSignal) {
    const abort = () => {
      if (!ac.signal.aborted) {
        ac.abort()
      }
    }
    if (externalSignal.aborted) {
      abort()
    } else {
      externalSignal.addEventListener("abort", abort)
      removeExternalAbortListener = () => externalSignal.removeEventListener("abort", abort)
    }
  }

  const timeout = setTimeout(() => ac.abort(), timeoutMs)
  try {
    let { data, error } = await build(ac.signal)
    if (error && retryOnAuth && shouldRetryAuth(error)) {
      try {
        await supabase.auth.refreshSession()
      } catch {}
      ;({ data, error } = await build(ac.signal))
    }
    const ms = Date.now() - started
    addMetric({ at: Date.now(), label, table, ms, status: error ? 'error' : 'ok', error: error?.message })
    return { data, error }
  } catch (err: any) {
    const ms = Date.now() - started
    const status: 'timeout' | 'aborted' | 'error' = ac.signal.aborted ? 'timeout' : 'error'
    addMetric({ at: Date.now(), label, table, ms, status, error: err?.message || String(err) })
    return { data: null as T | null, error: err }
  } finally {
    clearTimeout(timeout)
    if (removeExternalAbortListener) {
      removeExternalAbortListener()
    }
  }
}

function shouldRetryAuth(error: any): boolean {
  const code = (error?.code || error?.status || '').toString()
  const msg: string = (error?.message || '').toString()
  if (code === '401' || code === '403') return true
  if (/jwt|token|auth|expired/i.test(msg)) return true
  return false
}

