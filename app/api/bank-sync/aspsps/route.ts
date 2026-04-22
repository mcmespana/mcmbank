import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enableBanking, EnableBankingError } from "@/lib/enable-banking/client"

export const runtime = "nodejs"

/**
 * GET /api/bank-sync/aspsps?country=ES
 * Devuelve la lista de bancos disponibles para un país concreto.
 * Requiere usuario autenticado (no queremos exponer la lista a terceros).
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const url = new URL(request.url)
  const country = url.searchParams.get("country") || "ES"

  try {
    const { aspsps } = await enableBanking.listAspsps(country)
    // Filtramos a lo esencial para el dropdown
    const light = aspsps.map((a) => ({
      name: a.name,
      country: a.country,
      logo: a.logo,
      psu_types: a.psu_types,
      maximum_consent_validity: a.maximum_consent_validity,
      sandbox: !!a.sandbox,
      beta: !!a.beta,
      bic: a.bic,
    }))
    return NextResponse.json({ aspsps: light })
  } catch (err) {
    const status = err instanceof EnableBankingError ? err.status : 500
    return NextResponse.json(
      {
        error: "No se pudo listar ASPSPs",
        detalle: err instanceof Error ? err.message : String(err),
      },
      { status },
    )
  }
}
