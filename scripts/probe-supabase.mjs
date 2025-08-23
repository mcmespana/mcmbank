// Lightweight Supabase connectivity probe without Next.js
// Usage: node scripts/probe-supabase.mjs

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env")
    process.exit(1)
  }

  const supabase = createClient(url, anon)

  const tables = ["categoria", "cuenta", "movimiento", "delegacion", "membresia"]
  const out = []
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select("*", { count: "exact" }).limit(3)
      out.push({ table, count: count ?? null, sample: data ?? [], error: error?.message ?? null })
    } catch (e) {
      out.push({ table, count: null, sample: [], error: e?.message || "Unknown error" })
    }
  }

  console.log(JSON.stringify({ ok: true, results: out }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

