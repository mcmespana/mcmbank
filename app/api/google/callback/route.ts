import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteClient } from "@/lib/supabase/route"
import { exchangeCode, getRedirectUri, originFromRequest, saveCredencial } from "@/lib/services/google"

function redirectTo(status: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/informes?google=${status}`
}

export async function GET(req: Request) {
  // baseUrl = dominio real del usuario (mismo en el que se inició la conexión).
  const origin = originFromRequest(req)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) return NextResponse.redirect(redirectTo("error", origin))
  if (!code || !state) return NextResponse.redirect(redirectTo("error", origin))

  const store = await cookies()
  const expectedState = store.get("g_oauth_state")?.value
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(redirectTo("state", origin))
  }

  const { supabase, applyCookies } = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(redirectTo("noauth", origin))

  try {
    // El redirect_uri del intercambio DEBE ser el mismo que el de la autorización.
    const redirectUri = getRedirectUri(origin)
    const tokens = await exchangeCode(code, redirectUri)
    await saveCredencial(supabase, user.id, tokens)
    const res = NextResponse.redirect(redirectTo("ok", origin))
    applyCookies(res)
    res.cookies.delete("g_oauth_state")
    return res
  } catch (err: any) {
    console.error("Google callback error:", err?.message || err)
    return NextResponse.redirect(redirectTo("error", origin))
  }
}
