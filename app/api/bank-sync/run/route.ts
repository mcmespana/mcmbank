import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncCuenta, syncTodasLasCuentas } from "@/lib/enable-banking/sync"

export const runtime = "nodejs"
export const maxDuration = 300 // Pro: hasta 300s

/**
 * Ejecuta la sincronización bancaria.
 *
 * Modos:
 *   A) Cron  → Authorization: Bearer CRON_SECRET. Sincroniza todas las cuentas.
 *   B) Manual → sesión de usuario autenticado + cuenta_id. Un usuario solo puede
 *              forzar el sync de cuentas de sus delegaciones con rol editor/admin.
 *              Devuelve el log completo para mostrarlo en el UI.
 *
 * Query / body:
 *   cuenta_id?: UUID  (opcional en cron, obligatorio en manual)
 *   debug?: "1"       (igual; siempre devolvemos log en manual)
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || ""
  const url = new URL(request.url)
  const cuentaId = url.searchParams.get("cuenta_id")

  const cronSecret = process.env.CRON_SECRET
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  const admin = createAdminClient()

  if (isCron) {
    try {
      if (cuentaId) {
        const r = await syncCuenta(admin, cuentaId, { trigger: "cron" })
        return NextResponse.json({ ok: true, modo: "cron", resultado: r })
      }
      const { resultados } = await syncTodasLasCuentas(admin)
      return NextResponse.json({
        ok: true,
        modo: "cron",
        procesadas: resultados.length,
        resultados,
      })
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      )
    }
  }

  // Manual: requiere autenticación
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (!cuentaId) {
    return NextResponse.json({ error: "Falta cuenta_id" }, { status: 400 })
  }

  // Verificar permisos
  const { data: cuenta } = await admin
    .from("cuenta")
    .select("id, delegacion_id")
    .eq("id", cuentaId)
    .single()
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })
  }
  const { data: membresia } = await admin
    .from("membresia")
    .select("rol")
    .eq("delegacion_id", cuenta.delegacion_id)
    .eq("usuario_id", user.id)
    .maybeSingle()
  if (!membresia || !["admin", "editor"].includes(membresia.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  try {
    const r = await syncCuenta(admin, cuentaId, {
      trigger: "manual",
      iniciadoPor: user.id,
    })
    return NextResponse.json({ ok: true, modo: "manual", resultado: r })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
