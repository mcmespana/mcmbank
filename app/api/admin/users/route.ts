import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data: memberships } = await supabase
    .from("membresia")
    .select("usuario_id, rol, delegacion:delegacion_id (id, nombre)")
  const users = (data?.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    membresias: memberships?.filter((m) => m.usuario_id === u.id) || [],
  }))
  return NextResponse.json({ users })
}
