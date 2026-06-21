import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"

export async function POST() {
  const { supabase, applyCookies } = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const res = NextResponse.json({ error: "No autorizado" }, { status: 401 })
    applyCookies(res)
    return res
  }

  const { error } = await supabase.from("google_credencial").delete().eq("usuario_id", user.id)
  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 })
    applyCookies(res)
    return res
  }
  const res = NextResponse.json({ ok: true })
  applyCookies(res)
  return res
}
