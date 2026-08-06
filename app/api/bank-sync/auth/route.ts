import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enableBanking, EnableBankingError } from "@/lib/enable-banking/client"

export const runtime = "nodejs"

const Body = z.object({
  cuenta_id: z.string().uuid(),
  aspsp_name: z.string().min(1),
  aspsp_country: z.string().length(2),
  psu_type: z.enum(["personal", "business"]).default("business"),
  valid_days: z.number().int().min(1).max(180).default(90),
  // Fecha ISO "yyyy-mm-dd" desde la que traer movimientos en la primera sync.
  // null/omitido = todo el histórico que permita el banco.
  sync_desde_fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

/**
 * Inicia el flujo de autorización con Enable Banking.
 *   - Crea una fila pendiente en banco_conexion asociada a la delegación de la cuenta.
 *   - Llama a POST /auth en Enable Banking pasando state = banco_conexion.id.
 *   - Devuelve la URL a la que redirigir al PSU.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = Body.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: "Parámetros inválidos", detalle: body.error.format() }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Cargar cuenta y verificar que el usuario tiene acceso + rol gestor_central/tesorero
  const { data: cuenta, error: cuentaErr } = await admin
    .from("cuenta")
    .select("id, delegacion_id, nombre, tipo")
    .eq("id", body.data.cuenta_id)
    .single()

  if (cuentaErr || !cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })
  }

  const { data: membresia } = await admin
    .from("membresia")
    .select("rol")
    .eq("delegacion_id", cuenta.delegacion_id)
    .eq("usuario_id", user.id)
    .maybeSingle()

  if (!membresia || !["gestor_central", "tesorero"].includes(membresia.rol)) {
    return NextResponse.json({ error: "Sin permisos para conectar esta cuenta" }, { status: 403 })
  }

  // 1.b Persistir la fecha de inicio elegida (o limpiarla para "todo el histórico").
  // syncCuenta la respeta sin fallback en la primera sincronización.
  await admin
    .from("cuenta")
    .update({ sync_desde_fecha: body.data.sync_desde_fecha ?? null })
    .eq("id", cuenta.id)

  // 2. Crear banco_conexion pendiente
  const validUntil = new Date(Date.now() + body.data.valid_days * 24 * 60 * 60 * 1000)

  const { data: conexion, error: conexErr } = await admin
    .from("banco_conexion")
    .insert({
      delegacion_id: cuenta.delegacion_id,
      proveedor: "enablebanking",
      aspsp_name: body.data.aspsp_name,
      aspsp_country: body.data.aspsp_country,
      psu_type: body.data.psu_type,
      consent_valid_until: validUntil.toISOString(),
      estado: "pendiente",
      creado_por: user.id,
    })
    .select("id")
    .single()

  if (conexErr || !conexion) {
    console.error("bank-sync auth: error creando banco_conexion:", conexErr)
    return NextResponse.json({ error: "No se pudo crear la conexión" }, { status: 500 })
  }

  // 3. Guardar pairing pending {state → cuenta_id} para que el callback sepa qué cuenta linkar
  const pairingState = `${conexion.id}:${cuenta.id}`

  const redirectUrl = process.env.ENABLE_BANKING_REDIRECT_URL
  if (!redirectUrl) {
    return NextResponse.json({ error: "ENABLE_BANKING_REDIRECT_URL no configurado" }, { status: 500 })
  }

  // 4. Llamar a EB
  try {
    const res = await enableBanking.startAuth({
      access: { valid_until: validUntil.toISOString(), balances: true, transactions: true },
      aspsp: { name: body.data.aspsp_name, country: body.data.aspsp_country },
      state: pairingState,
      redirect_url: redirectUrl,
      psu_type: body.data.psu_type,
    })

    await admin
      .from("banco_conexion")
      .update({ authorization_id: res.authorization_id, psu_id_hash: res.psu_id_hash || null })
      .eq("id", conexion.id)

    return NextResponse.json({ url: res.url, banco_conexion_id: conexion.id })
  } catch (err) {
    const correlationId = randomUUID().slice(0, 8)
    const safeMessage = err instanceof Error ? err.message : String(err)
    const fullDetail = err instanceof EnableBankingError ? `${err.message}: ${JSON.stringify(err.body)}` : safeMessage
    console.error(`bank-sync auth error [${correlationId}]:`, fullDetail)
    await admin
      .from("banco_conexion")
      .update({ estado: "error", ultimo_error: `[${correlationId}] ${safeMessage}` })
      .eq("id", conexion.id)
    return NextResponse.json(
      { error: "Error iniciando autorización con el banco. Inténtalo de nuevo.", correlation_id: correlationId },
      { status: 502 },
    )
  }
}
