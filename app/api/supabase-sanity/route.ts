import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"

type TableProbe = {
  table: string
  count: number | null
  sample: unknown[]
  error?: string
}

async function probeTable(client: ReturnType<typeof createClient>, table: string): Promise<TableProbe> {
  try {
    const { data, error, count } = await client
      // El cliente tipado exige un nombre de tabla literal; aquí el nombre es
      // dinámico (sonda de salud sobre tablas arbitrarias), por eso el cast.
      .from(table as never)
      .select("*", { count: "exact" })
      .limit(3)

    if (error) {
      console.error(`supabase-sanity probe error (${table}):`, error)
      return { table, count: null, sample: [], error: "Error al consultar la tabla." }
    }

    return { table, count: count ?? null, sample: data ?? [] }
  } catch (e: any) {
    console.error(`supabase-sanity probe error (${table}):`, e)
    return { table, count: null, sample: [], error: "Error al consultar la tabla." }
  }
}

export async function GET() {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const client = createClient()

    const tables = ["categoria", "cuenta", "movimiento", "delegacion", "membresia"]

    const results = await Promise.all(tables.map((t) => probeTable(client, t)))

    return NextResponse.json({
      ok: true,
      info: "Supabase connectivity probe",
      results,
    })
  } catch (e: any) {
    console.error("supabase-sanity route error:", e)
    return NextResponse.json(
      { ok: false, error: "Ha ocurrido un error. Inténtalo de nuevo." },
      { status: 500 },
    )
  }
}
