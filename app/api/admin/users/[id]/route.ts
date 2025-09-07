import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const { password, name, memberships } = await req.json()

    // Optional: update password
    if (password) {
      const { error: passError } = await supabase.auth.admin.updateUserById(params.id, { password })
      if (passError) return NextResponse.json({ error: passError.message }, { status: 400 })
    }

    // Optional: update profile name
    if (typeof name === "string") {
      const { error: profileError } = await supabase
        .from("perfil")
        .upsert({ usuario_id: params.id, nombre_completo: name })
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Optional: replace memberships with per-delegation roles
    if (Array.isArray(memberships)) {
      // Replace all memberships for the user
      const { error: delError } = await supabase.from("membresia").delete().eq("usuario_id", params.id)
      if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

      const rows = memberships
        .filter((m: any) => m && m.delegacion_id && m.rol)
        .map((m: any) => ({ usuario_id: params.id, delegacion_id: m.delegacion_id, rol: m.rol }))

      if (rows.length) {
        const { error: insError } = await supabase.from("membresia").insert(rows)
        if (insError) return NextResponse.json({ error: insError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const { error: authErr } = await supabase.auth.admin.deleteUser(params.id)
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    await supabase.from("membresia").delete().eq("usuario_id", params.id)
    await supabase.from("perfil").delete().eq("usuario_id", params.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
