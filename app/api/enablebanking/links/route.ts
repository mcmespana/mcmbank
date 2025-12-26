import { NextResponse } from "next/server"
import { requireGestorCentral } from "@/lib/services/enablebanking-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: Request) {
  const auth = await requireGestorCentral()
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const cuentaId = body.cuenta_id as string
    const enablebankingAccountId = body.enablebanking_account_id as string
    const syncStartDate = body.sync_start_date as string | null

    if (!cuentaId || !enablebankingAccountId) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.from("enablebanking_link").upsert(
      {
        cuenta_id: cuentaId,
        enablebanking_account_id: enablebankingAccountId,
        sync_start_date: syncStartDate,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cuenta_id" },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error guardando vínculo" }, { status: 500 })
  }
}
