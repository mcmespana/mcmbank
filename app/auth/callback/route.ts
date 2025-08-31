import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      console.log("OAuth con Google exitoso para usuario", user?.id)
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
      return NextResponse.redirect(`${redirectUrl}${next}`)
    }
    console.warn("OAuth con Google no autorizado", error.message)
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
    const loginUrl = new URL("/auth/login", redirectUrl)
    loginUrl.searchParams.set(
      "error",
      "Tu correo no está autorizado. Contacta con un administrador.",
    )
    return NextResponse.redirect(loginUrl.toString())
  }

  console.error("OAuth callback sin código")
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
