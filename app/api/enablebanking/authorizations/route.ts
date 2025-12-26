import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { startAuthorization } from "@/lib/services/enablebanking-api"
import { requireGestorCentral } from "@/lib/services/enablebanking-auth"
import { createAdminClient } from "@/lib/supabase/admin"

const getRedirectUrl = () => {
  if (process.env.ENABLEBANKING_REDIRECT_URL) {
    return process.env.ENABLEBANKING_REDIRECT_URL
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL for Enable Banking redirect")
  }
  return `${siteUrl.replace(/\/$/, "")}/api/enablebanking/callback`
}

export async function POST(req: Request) {
  const auth = await requireGestorCentral()
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const aspspName = body.aspsp_name as string
    const aspspCountry = body.aspsp_country as string
    const aspspBic = body.aspsp_bic as string | undefined
    const psuType = (body.psu_type as string) || "business"
    const authMethod = body.auth_method as string | undefined
    const validDays = Number(body.valid_days || 90)

    if (!aspspName || !aspspCountry) {
      return NextResponse.json({ error: "Banco inválido" }, { status: 400 })
    }

    const state = randomUUID()
    const redirectUrl = getRedirectUrl()
    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString()

    const response = await startAuthorization({
      access: {
        valid_until: validUntil,
        balances: true,
        transactions: true,
      },
      aspsp: { name: aspspName, country: aspspCountry },
      state,
      redirect_url: redirectUrl,
      psu_type: psuType,
      auth_method: authMethod,
      language: "es",
    })

    const supabase = createAdminClient()
    let organizacionId = body.organizacion_id as string | undefined
    if (!organizacionId) {
      const { data: delegacion } = await supabase
        .from("delegacion")
        .select("organizacion_id")
        .limit(1)
        .maybeSingle()
      organizacionId = delegacion?.organizacion_id
    }
    if (!organizacionId) {
      return NextResponse.json({ error: "No se encontró organización" }, { status: 400 })
    }

    await supabase.from("enablebanking_consent").insert({
      organizacion_id: organizacionId,
      aspsp_name: aspspName,
      aspsp_country: aspspCountry,
      aspsp_bic: aspspBic || null,
      psu_type: psuType,
      authorization_id: response.authorization_id,
      state,
      redirect_url: redirectUrl,
      status: "pending",
    })

    return NextResponse.json({
      url: response.url,
      authorization_id: response.authorization_id,
      state,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error iniciando autorización" }, { status: 500 })
  }
}
