"use client"

import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, TrendingUp, Cpu } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { signIn } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"

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
  const oauthError =
    searchParams.get("error") === "unauthorized"
      ? "Tu correo no está autorizado. Contacta con un administrador."
      : null
  const [state, formAction] = useActionState(signIn, null)
  const supabase = createClient()

  // Handle successful login by redirecting
  useEffect(() => {
    if (state?.success) {
      router.push("/")
    }
  }, [state, router])

  async function handleGoogleLogin() {
    console.log("Inicio OAuth con Google")
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
    if (error) {
      console.error("Error en OAuth de Google", error)
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
                {state?.error || oauthError}
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

            <Button
              type="button"
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 bg-white text-foreground hover:bg-muted transition-all duration-300"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M5.266 9.765C6.199 6.939 8.854 4.909 12 4.909c1.691 0 3.218.6 4.418 1.582L19.909 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"
                />
                <path
                  fill="#34A853"
                  d="M16.041 18.013c-1.09.703-2.475 1.078-4.041 1.078-3.133 0-5.78-2.014-6.722-4.823L1.237 17.335C3.193 21.294 7.265 24 12 24c2.933 0 5.735-.863 7.834-2.821l-3.793-3.166Z"
                />
                <path
                  fill="#4A90E2"
                  d="M19.834 20.999C22.029 18.952 23.455 15.904 23.455 12c0-.709-.109-1.473-.273-2.182H12v4.636h6.436c-.317 1.559-1.17 2.766-2.396 3.559l3.793 3.166Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.277 14.268a7.545 7.545 0 0 1 0-4.503L1.24 6.65C.437 8.26 0 10.075 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"
                />
              </svg>
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
