type Metric = {
  at: number
  label: string
  table?: string
  ms: number
  status: 'ok' | 'error' | 'timeout' | 'aborted'
  error?: string
}

const metrics: Metric[] = []
const listeners = new Set<() => void>()
const MAX = 200

export function addMetric(m: Metric) {
  metrics.push(m)
  if (metrics.length > MAX) metrics.shift()
  listeners.forEach((l) => l())
}

export function getMetrics(): Metric[] {
  return [...metrics]
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

