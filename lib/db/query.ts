import { supabase } from "@/lib/supabase/client"
import { addMetric } from "@/lib/db/telemetry"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"

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
  registerAC(ac)

  const timeout = setTimeout(() => ac.abort(), timeoutMs)
  try {
    let { data, error } = await build(ac.signal)

    // Retry logic with abort validation
    if (error && retryOnAuth && shouldRetryAuth(error)) {
      // Check if request was aborted before retrying
      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted before retry' })
        return { data: null as T | null, error: new Error('Request aborted') }
      }

      try {
        // Wrap refreshSession in a timeout to prevent hanging the entire query
        await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 3000))
        ])
      } catch {
        // Ignore refresh errors or timeouts
      }

      // Check again after refresh
      if (ac.signal.aborted) {
        const ms = Date.now() - started
        addMetric({ at: Date.now(), label, table, ms, status: 'aborted', error: 'Request aborted after refresh' })
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
    unregisterAC(ac)
  }
}

function shouldRetryAuth(error: any): boolean {
  const code = (error?.code || error?.status || '').toString()
  const msg: string = (error?.message || '').toString()
  if (code === '401' || code === '403') return true
  if (/jwt|token|auth|expired/i.test(msg)) return true
  return false
}
