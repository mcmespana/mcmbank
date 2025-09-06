import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const { role, password, delegaciones } = await req.json()
  if (password) {
    await supabase.auth.admin.updateUserById(params.id, { password })
  }
  if (role) {
    // Update role across memberships (simple approach: update all to same role)
    await supabase
      .from("membresia")
      .update({ rol: role })
      .eq("usuario_id", params.id)
  }
  if (Array.isArray(delegaciones)) {
    // Replace delegations
    await supabase.from("membresia").delete().eq("usuario_id", params.id)
    const inserts = delegaciones.map((d: string) => ({
      usuario_id: params.id,
      delegacion_id: d,
      rol: role || "usuario",
    }))
    if (inserts.length) {
      await supabase.from("membresia").insert(inserts)
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  await supabase.auth.admin.deleteUser(params.id)
  await supabase.from("membresia").delete().eq("usuario_id", params.id)
  await supabase.from("perfil").delete().eq("usuario_id", params.id)
  return NextResponse.json({ ok: true })
}
