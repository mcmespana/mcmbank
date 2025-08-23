import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type TableProbe = {
  table: string
  count: number | null
  sample: unknown[]
  error?: string
}

async function probeTable(client: ReturnType<typeof createClient>, table: string): Promise<TableProbe> {
  try {
    const { data, error, count } = await client
      .from(table)
      .select("*", { count: "exact" })
      .limit(3)

    if (error) {
      return { table, count: null, sample: [], error: error.message }
    }

    return { table, count: count ?? null, sample: data ?? [] }
  } catch (e: any) {
    return { table, count: null, sample: [], error: e?.message || "Unknown error" }
  }
}

export async function GET() {
  try {
    const client = createClient()

    const tables = ["categoria", "cuenta", "movimiento", "delegacion", "membresia"]

    const results = await Promise.all(tables.map((t) => probeTable(client, t)))

    return NextResponse.json({
      ok: true,
      info: "Supabase connectivity probe",
      results,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ||
          "Supabase environment variables are missing or the server client could not be created.",
      },
      { status: 500 },
    )
  }
}

