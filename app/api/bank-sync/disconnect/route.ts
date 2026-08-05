import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enableBanking, EnableBankingError } from "@/lib/enable-banking/client"

export const runtime = "nodejs"

const Body = z.object({
  cuenta_id: z.string().uuid(),
  revoke_consent: z.boolean().default(true),
})

/**
 * Desconecta una cuenta de Enable Banking:
 *   1. Llama a DELETE /sessions/{id} si revoke_consent=true (best effort).
 *   2. Marca banco_conexion como 'revocada'.
 *   3. Pone cuenta.sync_enabled=false y limpia campos de link.
 * No borra movimientos ya importados.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = Body.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: cuenta } = await admin
    .from("cuenta")
    .select("id, delegacion_id, banco_conexion_id")
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
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  let revocationError: string | null = null
  if (body.data.revoke_consent && cuenta.banco_conexion_id) {
    const { data: conn } = await admin
      .from("banco_conexion")
      .select("session_id")
      .eq("id", cuenta.banco_conexion_id)
      .single()
    if (conn?.session_id) {
      try {
        await enableBanking.revokeSession(conn.session_id)
      } catch (err) {
        const fullDetail =
          err instanceof EnableBankingError ? `${err.message}: ${JSON.stringify(err.body)}` : String(err)
        console.error("bank-sync disconnect: error revocando sesión EB:", fullDetail)
        revocationError = "No se pudo revocar el consentimiento en el banco. La conexión se ha desactivado igualmente."
      }
    }
    await admin
      .from("banco_conexion")
      .update({ estado: "revocada" })
      .eq("id", cuenta.banco_conexion_id)
  }

  await admin
    .from("cuenta")
    .update({
      banco_conexion_id: null,
      external_account_uid: null,
      external_account_hash: null,
      sync_enabled: false,
      last_sync_status: null,
      last_sync_error: null,
      origen: "manual",
    })
    .eq("id", body.data.cuenta_id)

  return NextResponse.json({ ok: true, revocation_error: revocationError })
}
