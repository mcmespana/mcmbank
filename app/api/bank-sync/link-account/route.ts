import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizarIban } from "@/lib/utils/iban"
import type { EBAccountResource } from "@/lib/enable-banking/types"

export const runtime = "nodejs"

const Body = z.object({
  banco_conexion_id: z.string().uuid(),
  cuenta_id: z.string().uuid(),
  account_uid: z.string().min(1),
})

/** Devuelve los accounts pendientes de una conexión, para el selector manual. */
export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const banco_conexion_id = new URL(request.url).searchParams.get("banco_conexion_id")
  if (!banco_conexion_id) {
    return NextResponse.json({ error: "Falta banco_conexion_id" }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: conexion } = await admin
    .from("banco_conexion")
    .select("id, delegacion_id, accounts_pendientes")
    .eq("id", banco_conexion_id)
    .single()
  if (!conexion) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 })

  const { data: membresia } = await admin
    .from("membresia")
    .select("rol")
    .eq("delegacion_id", conexion.delegacion_id)
    .eq("usuario_id", user.id)
    .maybeSingle()
  if (!membresia) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  return NextResponse.json({ accounts: conexion.accounts_pendientes || [] })
}

/**
 * Completa el enlace cuenta↔account de Enable Banking cuando el callback no
 * pudo hacer match automático por IBAN (ver app/api/bank-sync/callback/route.ts).
 * El usuario elige manualmente entre los `accounts_pendientes` ya persistidos
 * — nunca se confía en un `account_uid` arbitrario del cliente sin
 * verificarlo contra esa lista.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = Body.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: cuenta } = await admin
    .from("cuenta")
    .select("id, iban, delegacion_id")
    .eq("id", body.data.cuenta_id)
    .single()
  if (!cuenta) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })

  const { data: membresia } = await admin
    .from("membresia")
    .select("rol")
    .eq("delegacion_id", cuenta.delegacion_id)
    .eq("usuario_id", user.id)
    .maybeSingle()
  if (!membresia || !["gestor_central", "tesorero"].includes(membresia.rol)) {
    return NextResponse.json({ error: "Sin permisos para enlazar esta cuenta" }, { status: 403 })
  }

  const { data: conexion } = await admin
    .from("banco_conexion")
    .select("id, delegacion_id, accounts_pendientes")
    .eq("id", body.data.banco_conexion_id)
    .single()
  if (!conexion) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 })
  if (conexion.delegacion_id !== cuenta.delegacion_id) {
    return NextResponse.json({ error: "La conexión no pertenece a la delegación de la cuenta" }, { status: 400 })
  }

  const pendientes = (conexion.accounts_pendientes as unknown as EBAccountResource[] | null) || []
  const match = pendientes.find((a) => a.uid === body.data.account_uid)
  if (!match) {
    return NextResponse.json(
      { error: "Esa cuenta no está entre las candidatas autorizadas para esta conexión" },
      { status: 400 },
    )
  }

  const cuentaIban = normalizarIban(cuenta.iban)

  await admin
    .from("cuenta")
    .update({
      banco_conexion_id: conexion.id,
      external_account_uid: match.uid,
      external_account_hash: match.identification_hash || null,
      sync_enabled: true,
      origen: "conectada",
      iban: cuentaIban || normalizarIban(match.account_id.iban) || null,
    })
    .eq("id", cuenta.id)

  await admin.from("banco_conexion").update({ accounts_pendientes: null }).eq("id", conexion.id)

  return NextResponse.json({ ok: true })
}
