import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireGestorCentral } from "@/lib/services/enablebanking-auth"

export async function GET() {
  const auth = await requireGestorCentral()
  if (auth.error) return auth.error

  const supabase = createAdminClient()

  const [consentsRes, accountsRes, linksRes, cuentasRes] = await Promise.all([
    supabase.from("enablebanking_consent").select("*").order("created_at", { ascending: false }),
    supabase.from("enablebanking_account").select("*").order("created_at", { ascending: false }),
    supabase.from("enablebanking_link").select("*"),
    supabase.from("cuenta").select("id, nombre, delegacion_id, banco_nombre, iban").order("nombre"),
  ])

  if (consentsRes.error || accountsRes.error || linksRes.error || cuentasRes.error) {
    const message =
      consentsRes.error?.message ||
      accountsRes.error?.message ||
      linksRes.error?.message ||
      cuentasRes.error?.message ||
      "Error cargando datos"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({
    consents: consentsRes.data || [],
    accounts: accountsRes.data || [],
    links: linksRes.data || [],
    cuentas: cuentasRes.data || [],
  })
}
