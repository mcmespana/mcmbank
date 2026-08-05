import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enableBanking, EnableBankingError } from "@/lib/enable-banking/client"
import { normalizarIban } from "@/lib/utils/iban"

export const runtime = "nodejs"

/**
 * Callback que Enable Banking invoca después del SCA. Llega como GET con
 * ?code=...&state=... (o ?error=...). Debemos:
 *   1. Extraer state = banco_conexion_id:cuenta_id
 *   2. Llamar a POST /sessions con el code
 *   3. Guardar session_id + accounts en banco_conexion
 *   4. Linkar la cuenta de MCM Bank con el account.uid correspondiente
 *   5. Redirigir a /cuentas con flag de éxito
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errParam = url.searchParams.get("error")
  const errDesc = url.searchParams.get("error_description")

  const origin = url.origin
  const redirectBase = `${origin}/cuentas`

  if (errParam) {
    return NextResponse.redirect(
      `${redirectBase}?bank_sync_error=${encodeURIComponent(errDesc || errParam)}`,
    )
  }
  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?bank_sync_error=missing_params`)
  }

  const [conexionId, cuentaId] = state.split(":")
  if (!conexionId || !cuentaId) {
    return NextResponse.redirect(`${redirectBase}?bank_sync_error=invalid_state`)
  }

  const admin = createAdminClient()

  try {
    // 0. Cargar la conexión y la cuenta ANTES de tocar nada, y verificar que
    // realmente pertenecen a la misma delegación y que la conexión sigue
    // pendiente de autorizar — el state (conexionId:cuentaId) llega por query
    // param y no debe asumirse consistente sin comprobarlo.
    const { data: conexion } = await admin
      .from("banco_conexion")
      .select("id, delegacion_id, estado")
      .eq("id", conexionId)
      .single()

    if (!conexion) {
      return NextResponse.redirect(`${redirectBase}?bank_sync_error=conexion_no_encontrada`)
    }
    if (conexion.estado !== "pendiente") {
      return NextResponse.redirect(`${redirectBase}?bank_sync_error=conexion_no_pendiente`)
    }

    const { data: cuenta } = await admin
      .from("cuenta")
      .select("id, iban, delegacion_id, banco_nombre, nombre")
      .eq("id", cuentaId)
      .single()

    if (!cuenta) {
      return NextResponse.redirect(`${redirectBase}?bank_sync_error=cuenta_no_encontrada`)
    }
    if (cuenta.delegacion_id !== conexion.delegacion_id) {
      console.error(
        `bank-sync callback: delegación mismatch entre conexión ${conexionId} (${conexion.delegacion_id}) y cuenta ${cuentaId} (${cuenta.delegacion_id})`,
      )
      return NextResponse.redirect(`${redirectBase}?bank_sync_error=estado_invalido`)
    }

    // 1. Crear sesión en EB
    const session = await enableBanking.createSession({ code })

    // 2. Actualizar banco_conexion
    await admin
      .from("banco_conexion")
      .update({
        session_id: session.session_id,
        estado: "autorizada",
        consent_valid_until: session.access.valid_until,
        ultimo_error: null,
      })
      .eq("id", conexionId)

    // 3. Matching con la cuenta de MCM Bank
    //    Si el usuario ya puso un IBAN en la cuenta, intentamos casar por IBAN primero.
    //    Si no, usamos el primer account del session.

    // Comparamos IBANs normalizados (sin espacios, mayúsculas) para que dé
    // igual si el usuario lo escribió en bloques de 4.
    const cuentaIban = normalizarIban(cuenta.iban)
    let match = session.accounts.find(
      (a) =>
        cuentaIban &&
        (normalizarIban(a.account_id.iban) === cuentaIban ||
          a.all_account_ids?.some((id) => normalizarIban(id.iban) === cuentaIban)),
    )
    if (!match && session.accounts.length === 1) {
      match = session.accounts[0]
    }

    if (!match) {
      // Varios accounts y ninguno casa → dejamos la conexión autorizada pero
      // la cuenta sin linkar. El frontend debería mostrar un selector manual
      // posteriormente. De momento marcamos error parcial.
      return NextResponse.redirect(
        `${redirectBase}?bank_sync_error=` +
          encodeURIComponent(
            `Se autorizó la conexión pero hay ${session.accounts.length} cuentas y ninguna casa con el IBAN "${cuenta.iban || "sin IBAN"}". Edita la cuenta y pega el IBAN, o contacta soporte.`,
          ),
      )
    }

    // 4. Linkar y activar
    await admin
      .from("cuenta")
      .update({
        banco_conexion_id: conexionId,
        external_account_uid: match.uid,
        external_account_hash: match.identification_hash || null,
        sync_enabled: true,
        origen: "conectada",
        // Si la cuenta no tenía IBAN, lo copiamos del account de EB
        iban: cuentaIban || normalizarIban(match.account_id.iban) || null,
      })
      .eq("id", cuentaId)

    return NextResponse.redirect(`${redirectBase}?bank_sync_ok=1&cuenta_id=${cuentaId}`)
  } catch (err) {
    const correlationId = randomUUID().slice(0, 8)
    const safeMessage = err instanceof Error ? err.message : String(err)
    const fullDetail =
      err instanceof EnableBankingError ? `${err.message}: ${JSON.stringify(err.body).slice(0, 500)}` : safeMessage
    console.error(`bank-sync callback error [${correlationId}]:`, fullDetail)
    await admin
      .from("banco_conexion")
      .update({ estado: "error", ultimo_error: `[${correlationId}] ${safeMessage}` })
      .eq("id", conexionId)
    return NextResponse.redirect(
      `${redirectBase}?bank_sync_error=${encodeURIComponent(`Error conectando con el banco (ref. ${correlationId}). Inténtalo de nuevo.`)}`,
    )
  }
}
