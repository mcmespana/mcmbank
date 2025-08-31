"use client"

import { useFormStatus } from "react-dom"
import { useActionState, useEffect, type SVGProps } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, TrendingUp, Cpu } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/client"

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

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        fill="#FBBC05"
        d="M9.827 24c0-1.524.253-2.985.705-4.356L2.623 13.604C1.082 16.734.214 20.26.214 24c0 3.737.867 7.261 2.406 10.388l7.904-6.05A14.17 14.17 0 0 1 9.827 24"
      />
      <path
        fill="#EB4335"
        d="M23.714 10.133c3.311 0 6.302 1.173 8.652 3.093L39.202 6.4C35.036 2.773 29.695.533 23.714.533 14.427.533 6.445 5.844 2.623 13.604l7.909 6.04c1.822-5.532 7.017-9.51 13.182-9.51"
      />
      <path
        fill="#34A853"
        d="M23.714 37.867c-6.165 0-11.36-3.978-13.182-9.51l-7.909 6.091C6.445 42.156 14.427 47.467 23.714 47.467c5.732 0 11.205-2.035 15.312-5.849l-7.507-5.804c-2.118 1.334-4.785 2.052-7.805 2.052"
      />
      <path
        fill="#4285F4"
        d="M46.145 24c0-1.387-.213-2.88-.534-4.267H23.714V28.8h12.605a11.89 11.89 0 0 1-4.8 7.014l7.507 5.804C43.339 37.614 46.145 31.649 46.145 24"
      />
    </svg>
  )
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oauthError = searchParams.get("error")
  const [state, formAction] = useActionState(signIn, null)

  // Handle successful login by redirecting
  useEffect(() => {
    if (state?.success) {
      router.push("/")
    }
  }, [state, router])

  async function handleGoogleSignIn() {
    console.log("Iniciando OAuth con Google")
    const supabase = createClient()
    const redirectTo =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    })
    if (error) {
      console.error("Error iniciando OAuth", error)
    }
  }

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

      <Card className="backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl transition-all duration-500 hover:shadow-3xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 transition-all duration-300 hover:bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            MCM Bank
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Bienvenido a la aplicación de tesorería del MCM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={formAction} className="space-y-4">
            {(state?.error || oauthError) && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg animate-in slide-in-from-top-2 duration-300">
                {state?.error ?? oauthError}
              </div>
            )}

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

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/30"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card/95 px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              className="w-full group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] bg-background"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Entrar con Google
            </Button>

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
