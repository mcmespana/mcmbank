import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"

export async function GET() {
  const { supabase, applyCookies } = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const res = NextResponse.json({ connected: false }, { status: 401 })
    applyCookies(res)
    return res
  }

  const { data } = await (supabase as any)
    .from("google_credencial")
    .select("email, actualizado_en")
    .eq("usuario_id", user.id)
    .maybeSingle()

  const res = NextResponse.json({
    connected: !!data,
    email: data?.email ?? null,
  })
  applyCookies(res)
  return res
}
