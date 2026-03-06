"use client"

import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, TrendingUp, Cpu } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { signIn } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { getAuthCallbackUrl, getDebugAuthConfig } from "@/lib/supabase/redirect"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Iniciando sesión...
        </>
      ) : (
        "Iniciar Sesión"
      )}
    </Button>
  )
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, formAction] = useActionState(signIn, null)

  const supabase = createClient()
  const debugAuthConfig = getDebugAuthConfig({ fallbackToWindow: true })
  const shouldShowDebug = searchParams.get("debug") === "1"

  async function handleGoogleLogin() {
    const redirectTo = getAuthCallbackUrl({ fallbackToWindow: true })
    console.log("OAuth start", {
      provider: "google",
      redirectTo,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      devRedirectUrl: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
      origin: window.location.origin,
    })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
    if (error) console.error("OAuth error", error)
  }

  // Handle successful login by redirecting
  useEffect(() => {
    if (state?.success) {
      router.push("/")
    }
  }, [state, router])

  return (
    <div className="relative z-10 w-full max-w-md">
      {/* Floating icons animation */}
      <div className="absolute -top-20 -left-10 opacity-20 animate-pulse">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="absolute -top-16 -right-8 opacity-20 animate-pulse" style={{ animationDelay: "1s" }}>
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="absolute -bottom-16 -left-6 opacity-20 animate-pulse" style={{ animationDelay: "2s" }}>
        <Cpu className="h-7 w-7 text-muted-foreground" />
      </div>

      <Card className="backdrop-blur-2xl bg-card/90 border-2 border-border/30 shadow-2xl transition-all duration-500 hover:shadow-3xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 transition-all duration-300 hover:scale-110 hover:shadow-xl border border-primary/20">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-4xl font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
            MCM Bank
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground/90">
            Bienvenido a la aplicación de tesorería del MCM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(state?.error || searchParams.get("error")) && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg animate-in slide-in-from-top-2 duration-300">
              {state?.error || searchParams.get("error")}
            </div>
          )}

          <Button
            type="button"
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 488 512"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#EA4335"
                d="M488 261.8c0-17.2-1.5-34-4.3-50.2H249v95.1h134.4a115 115 0 0 1-50 75.6l81.1 62.9c47.3-43.6 74.5-108 74.5-183.4z"
              />
              <path
                fill="#34A853"
                d="M249 492c67.6 0 124-22.4 165.3-60.9l-81.1-62.9c-22.4 15-51 23.8-84.2 23.8-64.7 0-119.6-43.7-139.2-102.6l-84.9 65.5C56 424.8 146.5 492 249 492z"
              />
              <path
                fill="#FBBC05"
                d="M109.8 289.4c-4.8-14.3-7.5-29.6-7.5-45.4s2.7-31.1 7.5-45.4l-84.9-65.5C9.2 165.3 0 206 0 252s9.2 86.7 24.9 123.7l84.9-65.5z"
              />
              <path
                fill="#4285F4"
                d="M249 97.3c35.3 0 67 12.1 91.9 35.9l68.9-68.9C373 26 318.5 0 249 0 146.5 0 56 67.2 24.9 168.3l84.9 65.5C129.4 141 184.3 97.3 249 97.3z"
              />
            </svg>
            Entrar con Google
          </Button>
          {shouldShowDebug && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Depuración OAuth</p>
              <ul className="mt-2 space-y-1">
                <li>Base normalizada: {debugAuthConfig.normalizedBaseUrl || "No disponible"}</li>
                <li>Callback OAuth: {debugAuthConfig.oauthCallbackUrl || "No disponible"}</li>
                <li>NEXT_PUBLIC_SITE_URL: {debugAuthConfig.siteUrl || "No definida"}</li>
                <li>NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL: {debugAuthConfig.devRedirectUrl || "No definida"}</li>
                <li>Origin actual: {debugAuthConfig.origin || "No disponible"}</li>
                <li>
                  {debugAuthConfig.hasProtocol
                    ? "✅ NEXT_PUBLIC_SITE_URL incluye protocolo."
                    : "⚠️ NEXT_PUBLIC_SITE_URL sin protocolo. Usa https://..."}
                </li>
                <li>Tip: agrega ?debug=1 para ver este panel.</li>
              </ul>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/30"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o</span>
            </div>
          </div>

          <form action={formAction} className="space-y-4">

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground/80">
                Mail MCM Local para el acceso
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tumcm@movimientoconsolacion.com"
                required
                className="transition-all duration-300 focus:scale-[1.02] focus:shadow-lg"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground/80">
                Código de acceso
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="transition-all duration-300 focus:scale-[1.02] focus:shadow-lg"
              />
            </div>

            <SubmitButton />

            <div className="text-center text-sm text-muted-foreground">
              ¿No tienes cuenta? Solicítala a tu responsable{" "}
              <Link
                href="/auth/sign-up"
                className="text-primary hover:underline transition-all duration-200 hover:text-primary/80"
              >
                desde aquí
              </Link>
            </div>
          </form>

          {/* Subtle tech indicators */}
          <div className="flex justify-center space-x-4 pt-4 border-t border-border/30">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Seguro</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0.5s" }}></div>
              <span>Conectado</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: "1s" }}></div>
              <span>24/7</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
