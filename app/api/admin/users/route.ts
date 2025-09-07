import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.listUsers()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const { data: memberships, error: mErr } = await supabase
      .from("membresia")
      .select("usuario_id, rol, delegacion:delegacion_id (id, nombre)")
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    const users = (data?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      membresias: memberships?.filter((m) => m.usuario_id === u.id) || [],
    }))
    return NextResponse.json({ users })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()
    const { email, password, name, memberships } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }
    const emailRegex = /.+@.+\..+/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 })
    }

    // Create auth user
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      console.error('admin.createUser error:', createError)
      return NextResponse.json({ error: createError?.message || "No se pudo crear el usuario", status: (createError as any)?.status }, { status: 400 })
    }

    const userId = created.user.id

    // Create/Upsert profile
    if (typeof name === "string" && name.trim().length > 0) {
      const { error: profileError } = await supabase
        .from("perfil")
        .upsert({ usuario_id: userId, nombre_completo: name })
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    // Insert memberships with per-delegation roles
    if (Array.isArray(memberships) && memberships.length > 0) {
      const rows = memberships
        .filter((m: any) => m && m.delegacion_id && m.rol)
        .map((m: any) => ({ usuario_id: userId, delegacion_id: m.delegacion_id, rol: m.rol }))
      if (rows.length) {
        const { error: insError } = await supabase.from("membresia").insert(rows)
        if (insError) {
          return NextResponse.json({ error: insError.message }, { status: 400 })
        }
      }
    }

    return NextResponse.json({ ok: true, user: { id: userId, email } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
