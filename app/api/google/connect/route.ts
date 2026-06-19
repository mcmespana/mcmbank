import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { getAuthUrl } from "@/lib/services/google"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const state = randomUUID()
    const url = getAuthUrl(state)
    const res = NextResponse.redirect(url)
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
