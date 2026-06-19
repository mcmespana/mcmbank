import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { exchangeCode, saveCredencial } from "@/lib/services/google"

function redirectTo(status: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/informes?google=${status}`
}

export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) return NextResponse.redirect(redirectTo("error", baseUrl))
  if (!code || !state) return NextResponse.redirect(redirectTo("error", baseUrl))

  const store = await cookies()
  const expectedState = store.get("g_oauth_state")?.value
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(redirectTo("state", baseUrl))
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(redirectTo("noauth", baseUrl))

  try {
    const tokens = await exchangeCode(code)
    await saveCredencial(supabase, user.id, tokens)
    const res = NextResponse.redirect(redirectTo("ok", baseUrl))
    res.cookies.delete("g_oauth_state")
    return res
  } catch (err: any) {
    console.error("Google callback error:", err?.message || err)
    return NextResponse.redirect(redirectTo("error", baseUrl))
  }
}
