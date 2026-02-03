import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/"
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const normalizeUrl = (url: string) => {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return `https://${url}`
  }
  const siteUrl = normalizeUrl(rawSiteUrl)

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
        const redirectBase = siteUrl || origin
        if (!profile) {
          console.warn("OAuth unauthorized", { userId: user.id })
          await supabase.auth.signOut()
          const message = encodeURIComponent(
            "Tu correo no está autorizado. Contacta con un administrador.",
          )
          return NextResponse.redirect(
            `${redirectBase}/auth/login?error=${message}`,
          )
        }
        console.log("OAuth success", {
          userId: user.id,
          redirectBase,
          next,
          origin,
          rawSiteUrl,
        })
        return NextResponse.redirect(`${redirectBase}${next}`)
      }
    }
    console.error("OAuth exchange failed", {
      error: error?.message,
      origin,
      rawSiteUrl,
      siteUrl,
    })
    if (rawSiteUrl && !rawSiteUrl.startsWith("http")) {
      console.warn("OAuth config: NEXT_PUBLIC_SITE_URL missing protocol", {
        rawSiteUrl,
      })
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
