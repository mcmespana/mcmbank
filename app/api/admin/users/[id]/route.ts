import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase keys")
  }
  return createClient(supabaseUrl, serviceKey)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient()
  const body = await request.json()
  if (body.password) {
    const { error } = await supabase.auth.admin.updateUserById(params.id, {
      password: body.password,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(params.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

