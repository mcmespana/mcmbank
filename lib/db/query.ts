import { addMetric } from "@/lib/db/telemetry"
import { supabase } from "@/lib/supabase/client"

export interface RunQueryOptions<T> {
  label: string
  table?: string
  timeoutMs?: number
  build: (signal: AbortSignal) => Promise<{ data: T | null; error: any }>
  retryOnAuth?: boolean
}

export async function runQuery<T>({ label, table, timeoutMs = 15000, build, retryOnAuth = true }: RunQueryOptions<T>) {
  const started = Date.now()
  const ac = new AbortController()

  const timeout = setTimeout(() => ac.abort(), timeoutMs)
  try {
    let { data, error } = await build(ac.signal)

    // On auth error, let the Supabase client handle token refresh internally,
    // then retry the query once. We do NOT manually call refreshSession() because
    // it can stall when HTTP connections are being reestablished (e.g. after tab switch).
    if (error && retryOnAuth && shouldRetryAuth(error)) {
      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted before retry' })
        return { data: null as T | null, error: new Error('Request aborted') }
      }

      // Quick session check — no network call, just reads from local storage/memory
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'error', error: 'No session for retry' })
        return { data: null as T | null, error: new Error('No session') }
      }

      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted after session check' })
        return { data: null as T | null, error: new Error('Request aborted') }
      }

      ; ({ data, error } = await build(ac.signal))
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
  }
}

function shouldRetryAuth(error: any): boolean {
  const code = (error?.code || error?.status || '').toString()
  const msg: string = (error?.message || '').toString()
  if (code === '401' || code === '403') return true
  if (/jwt|token|auth|expired/i.test(msg)) return true
  return false
}
