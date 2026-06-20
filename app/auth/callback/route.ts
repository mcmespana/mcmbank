import { createClient } from "@/lib/supabase/server"
import { getAppBaseUrl } from "@/lib/supabase/redirect"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Validar el parámetro "next": solo permitimos redirecciones internas.
  // Un simple startsWith("/") deja pasar URLs protocol-relative ("//evil.com"),
  // así que resolvemos contra el origin y comprobamos que sea el mismo dominio.
  const nextParam = searchParams.get("next") ?? "/"
  let next = "/"
  try {
    const candidate = new URL(nextParam, origin)
    if (candidate.origin === origin) {
      next = `${candidate.pathname}${candidate.search}${candidate.hash}`
    }
  } catch {
    next = "/"
  }

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("perfil")
          .select("usuario_id")
          .eq("usuario_id", user.id)
          .single()
        const redirectUrl = getAppBaseUrl({ origin }) || origin
        if (!profile) {
          console.warn("OAuth unauthorized", { userId: user.id })
          await supabase.auth.signOut()
          const message = encodeURIComponent(
            "Tu correo no está autorizado. Contacta con un administrador.",
          )
          return NextResponse.redirect(
            `${redirectUrl}/auth/login?error=${message}`,
          )
        }
        return NextResponse.redirect(`${redirectUrl}${next}`)
      }
    }
    if (error) {
      console.error("OAuth exchange error", { message: error.message })
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
