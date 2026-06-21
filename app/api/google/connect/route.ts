import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createRouteClient } from "@/lib/supabase/route"
import { getAuthUrl, getRedirectUri, originFromRequest } from "@/lib/services/google"

export async function GET(req: Request) {
  const { supabase, applyCookies } = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const state = randomUUID()
    // redirect_uri ligado al dominio real del usuario: así el callback vuelve al
    // mismo sitio y la cookie de state (y la sesión) coinciden.
    const redirectUri = getRedirectUri(originFromRequest(req))
    const url = getAuthUrl(state, redirectUri)
    const res = NextResponse.redirect(url)
    applyCookies(res)
    res.cookies.set("g_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    })
    return res
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "No se pudo iniciar la conexión con Google" },
      { status: 500 },
    )
  }
}
