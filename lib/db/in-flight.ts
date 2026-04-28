// Global registry of active AbortControllers for all in-flight Supabase queries.
// abortAllInFlight() is called when the tab regains focus to immediately kill
// any fetch that Chrome suspended mid-flight — those never resolve on their own,
// leaving hooks stuck in loading=true forever.

const registry = new Set<AbortController>()

export function registerAC(ac: AbortController): void {
  registry.add(ac)
}

export function unregisterAC(ac: AbortController): void {
  registry.delete(ac)
}

export function abortAllInFlight(): void {
  for (const ac of registry) {
    try {
      ac.abort(new Error("tab-focus-reset"))
    } catch {
      // ignore
    }
  }
  registry.clear()
}

export function inFlightSize(): number {
  return registry.size
}
