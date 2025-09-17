import { supabase } from "@/lib/supabase/client"
import { addMetric } from "@/lib/db/telemetry"

export interface RunQueryOptions<T> {
  label: string
  table?: string
  timeoutMs?: number
  build: (signal: AbortSignal) => Promise<{ data: T | null; error: any }>
  retryOnAuth?: boolean
  abortController?: AbortController
}

export const QUERY_TIMEOUT_ERROR_NAME = 'QueryTimeoutError' as const

function createTimeoutError(label: string, timeoutMs: number) {
  const error = new Error(`Query "${label}" timed out after ${timeoutMs}ms`)
  error.name = QUERY_TIMEOUT_ERROR_NAME
  return error
}

export async function runQuery<T>({
  label,
  table,
  timeoutMs = 15000,
  build,
  retryOnAuth = true,
  abortController,
}: RunQueryOptions<T>) {
  const started = Date.now()
  const internalController = new AbortController()

  const handleExternalAbort = () => {
    internalController.abort()
  }

  if (abortController) {
    if (abortController.signal.aborted) {
      internalController.abort()
    } else {
      abortController.signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  const runWithTimeout = async () => {
    if (!timeoutMs || timeoutMs <= 0) {
      return await build(internalController.signal)
    }

    let timeoutId: NodeJS.Timeout | undefined
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort()
          }
          internalController.abort()
          reject(createTimeoutError(label, timeoutMs))
        }, timeoutMs)
      })

      return (await Promise.race([
        build(internalController.signal),
        timeoutPromise,
      ])) as { data: T | null; error: any }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  try {
    let { data, error } = await runWithTimeout()
    if (error && retryOnAuth && shouldRetryAuth(error)) {
      try {
        await supabase.auth.refreshSession()
      } catch {}
      ;({ data, error } = await runWithTimeout())
    }
    const ms = Date.now() - started
    addMetric({ at: Date.now(), label, table, ms, status: error ? 'error' : 'ok', error: error?.message })
    return { data, error }
  } catch (err: any) {
    const ms = Date.now() - started
    const status: 'timeout' | 'aborted' | 'error' =
      err?.name === QUERY_TIMEOUT_ERROR_NAME
        ? 'timeout'
        : internalController.signal.aborted || abortController?.signal.aborted
          ? 'aborted'
          : 'error'
    addMetric({ at: Date.now(), label, table, ms, status, error: err?.message || String(err) })
    return { data: null as T | null, error: err }
  } finally {
    if (abortController) {
      abortController.signal.removeEventListener('abort', handleExternalAbort)
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

