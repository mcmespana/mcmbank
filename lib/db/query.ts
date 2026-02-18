import { addMetric } from "@/lib/db/telemetry"

export interface RunQueryOptions<T> {
  label: string
  table?: string
  timeoutMs?: number
  build: (signal: AbortSignal) => Promise<{ data: T | null; error: any }>
  retryOnAuth?: boolean
}

export async function runQuery<T>({ label, table, timeoutMs = 25000, build, retryOnAuth = true }: RunQueryOptions<T>) {
  const started = Date.now()
  const ac = new AbortController()

  const timeout = setTimeout(() => ac.abort(), timeoutMs)
  try {
    let { data, error } = await build(ac.signal)

    // On auth error (401/403), retry ONCE after a short delay.
    //
    // WHY a delay instead of getSession(): The Supabase JS client uses the
    // Navigator LockManager API for auth operations. When the tab regains focus
    // and the token is expired, the client's own visibilitychange handler
    // acquires an exclusive lock and starts refreshing the token (network call
    // to /auth/v1/token, 1-5s). Any call to getSession() during this time
    // BLOCKS on the same lock for up to 10 seconds (lockAcquireTimeout).
    //
    // Instead, we wait 2 seconds for the Supabase client to finish its
    // internal token refresh, then retry the query. The retry will use the
    // fresh token automatically.
    if (error && retryOnAuth && shouldRetryAuth(error)) {
      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted before retry' })
        return { data: null as T | null, error: new Error('Request aborted') }
      }

      // Wait for the Supabase client to finish its internal token refresh.
      // The client's _onVisibilityChanged handler runs concurrently and will
      // refresh the token + update storage. After this delay, the next query
      // will automatically use the new token.
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted after auth wait' })
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
