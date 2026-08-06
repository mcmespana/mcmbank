import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { generateEnableBankingJWT, privateKeyFingerprint } from "@/lib/enable-banking/jwt"

export const runtime = "nodejs"

/**
 * Diagnóstico de configuración de Enable Banking, sin exponer nunca los
 * valores reales de los secretos — solo booleanos y el fingerprint (hash)
 * ya seguro que expone `privateKeyFingerprint()`.
 */
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const result: Record<string, unknown> = {
    appIdConfigured: !!process.env.ENABLE_BANKING_APP_ID,
    privateKeyConfigured: !!process.env.ENABLE_BANKING_PRIVATE_KEY,
    redirectUrlConfigured: !!process.env.ENABLE_BANKING_REDIRECT_URL,
    cronSecretConfigured: !!process.env.CRON_SECRET,
  }

  try {
    generateEnableBankingJWT()
    result.jwtSigning = "ok"
    result.privateKeyFingerprint = privateKeyFingerprint()
  } catch (err) {
    result.jwtSigning = "failed"
    result.jwtError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(result)
}
