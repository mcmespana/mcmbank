import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false }, { status: 401 })

  const { data } = await (supabase as any)
    .from("google_credencial")
    .select("email, actualizado_en")
    .eq("usuario_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    email: data?.email ?? null,
  })
}
