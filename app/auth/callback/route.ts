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
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
      if (user) {
        const { data: profile } = await supabase
          .from("perfil")
          .select("usuario_id")
          .eq("usuario_id", user.id)
          .maybeSingle()

        if (!profile) {
          console.warn("OAuth unauthorized", { email: user.email })
          await supabase.auth.signOut()
          return NextResponse.redirect(`${redirectUrl}/auth/login?error=unauthorized`)
        }

        console.log("OAuth success", { user: user.id })
        return NextResponse.redirect(`${redirectUrl}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
