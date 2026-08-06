import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"

export async function GET() {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.listUsers()
    if (error) {
      console.error("admin.listUsers error:", error)
      return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
    }
    const { data: memberships, error: mErr } = await (supabase as any)
      .from("membresia")
      .select("usuario_id, rol, delegacion:delegacion_id (id, nombre)")
    if (mErr) {
      console.error("admin users membresia query error:", mErr)
      return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
    }
    const users = (data?.users || [])
      .map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        membresias: memberships?.filter((m: any) => m.usuario_id === u.id) || [],
      }))
      .sort((a, b) => {
        const aTime = new Date(a.createdAt ?? 0).getTime()
        const bTime = new Date(b.createdAt ?? 0).getTime()
        return bTime - aTime
      })
    return NextResponse.json({ users })
  } catch (err: any) {
    console.error("admin users API error:", err)
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const supabase = createAdminClient()
    const { email, password, name, memberships } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
      return NextResponse.json({ error: "No se pudo crear el usuario. Inténtalo de nuevo." }, { status: 400 })
    }

    const userId = created.user.id

    // Create/Upsert profile
    if (typeof name === "string" && name.trim().length > 0) {
      const { error: profileError } = await (supabase as any)
        .from("perfil")
        .upsert({ usuario_id: userId, nombre_completo: name })
      if (profileError) {
        console.error("admin create perfil error:", profileError)
        return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 400 })
      }
    }

    // Insert memberships with per-delegation roles
    if (Array.isArray(memberships) && memberships.length > 0) {
      const rows = memberships
        .filter((m: any) => m && m.delegacion_id && m.rol)
        .map((m: any) => ({ usuario_id: userId, delegacion_id: m.delegacion_id, rol: m.rol }))
      if (rows.length) {
        const { error: insError } = await (supabase as any).from("membresia").insert(rows)
        if (insError) {
          console.error("admin create membresia error:", insError)
          return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 400 })
        }
      }
    }

    return NextResponse.json({ ok: true, user: { id: userId, email } }, { status: 201 })
  } catch (err: any) {
    console.error("admin users API error:", err)
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
  }
}
