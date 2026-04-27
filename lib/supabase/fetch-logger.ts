// Diagnostic fetch interceptor — logs every request to Supabase REST/auth so
// we can see in the console whether requests are being issued, how long
// they take, and whether they error.
// Mount once via the imported side-effect from the supabase client module.

let installed = false

export function installFetchLogger(): void {
  if (installed || typeof window === "undefined") return
  installed = true
  console.log("[fetch-logger] installed")

  const original = window.fetch.bind(window)

  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url = ""
    let method = init?.method || "GET"
    try {
      if (typeof input === "string") url = input
      else if (input instanceof URL) url = input.toString()
      else if (input && typeof (input as Request).url === "string") {
        url = (input as Request).url
        method = (input as Request).method || method
      }
    } catch {}

    // Log all non-internal URLs briefly so we can verify the interceptor is
    // alive even when no Supabase request is fired (the bug).
    const isSupabase = url.includes("supabase.co")
    const isInternal = url.includes("/_next/") || url.includes("/_vercel/") || url.endsWith(".js") || url.endsWith(".css")
    if (!isSupabase) {
      if (!isInternal) console.log(`[fetch] (non-supabase) ${method} ${url.split("?")[0]}`)
      return original(input as any, init)
    }

    const tag = `[fetch] ${method} ${url.split("?")[0].split("supabase.co")[1] || url}`
    const startedAt = Date.now()
    console.log(`${tag} → start`)

    return original(input as any, init).then(
      (res) => {
        console.log(`${tag} ← ${res.status} (${Date.now() - startedAt}ms)`)
        return res
      },
      (err) => {
        console.log(`${tag} ✗ ${err?.name || "error"} (${Date.now() - startedAt}ms): ${err?.message}`)
        throw err
      },
    )
  }
}
