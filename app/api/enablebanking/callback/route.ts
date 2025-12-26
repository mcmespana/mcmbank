import { NextResponse } from "next/server"
import { authorizeSession } from "@/lib/services/enablebanking-api"
import { createAdminClient } from "@/lib/supabase/admin"

const getRedirectTarget = (status: string, baseUrl: string) =>
  `${baseUrl.replace(/\/$/, "")}/configuracion?enablebanking=${status}`

const extractIban = (account: {
  account_id?: { iban?: string }
  all_account_ids?: Array<{ scheme?: string; identification?: string }>
}) => {
  if (account.account_id?.iban) return account.account_id.iban
  const iban = account.all_account_ids?.find((item) => item.scheme === "IBAN")?.identification
  return iban || null
}

export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const supabase = createAdminClient()

  if (!state) {
    return NextResponse.redirect(getRedirectTarget("missing_state", baseUrl))
  }

  const { data: consent } = await supabase
    .from("enablebanking_consent")
    .select("id")
    .eq("state", state)
    .maybeSingle()

  if (!consent) {
    return NextResponse.redirect(getRedirectTarget("unknown_state", baseUrl))
  }

  if (error) {
    await supabase
      .from("enablebanking_consent")
      .update({ status: "failed", error_code: error, error_description: errorDescription })
      .eq("id", consent.id)
    return NextResponse.redirect(getRedirectTarget("failed", baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(getRedirectTarget("missing_code", baseUrl))
  }

  try {
    const session = await authorizeSession(code)

    await supabase
      .from("enablebanking_consent")
      .update({
        status: "authorized",
        session_id: session.session_id,
        authorized_at: new Date().toISOString(),
      })
      .eq("id", consent.id)

    if (Array.isArray(session.accounts)) {
      const rows = session.accounts.map((account) => ({
        consent_id: consent.id,
        provider_account_id: account.uid || account.identification_hash || randomFallbackId(account),
        identification_hash: account.identification_hash || null,
        iban: extractIban(account),
        currency: account.currency || null,
        owner_name: account.name || null,
        raw_payload: account,
      }))

      for (const row of rows) {
        await supabase.from("enablebanking_account").upsert(row, {
          onConflict: "provider_account_id",
        })
      }
    }

    return NextResponse.redirect(getRedirectTarget("authorized", baseUrl))
  } catch (err: any) {
    await supabase
      .from("enablebanking_consent")
      .update({ status: "failed", error_code: "session_error", error_description: err?.message || "" })
      .eq("id", consent.id)
    return NextResponse.redirect(getRedirectTarget("failed", baseUrl))
  }
}

const randomFallbackId = (account: { name?: string }) => {
  const base = account?.name || "enablebanking-account"
  return `${base}-${Date.now()}`
}
