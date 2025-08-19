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
  const [state, formAction] = useActionState(signIn, null)

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

      <Card className="backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl transition-all duration-500 hover:shadow-3xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 transition-all duration-300 hover:bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            MCM Bank
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Bienvenido al futuro de la banca digital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg animate-in slide-in-from-top-2 duration-300">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground/80">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
                className="transition-all duration-300 focus:scale-[1.02] focus:shadow-lg"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground/80">
                Contraseña
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
              ¿No tienes cuenta?{" "}
              <Link
                href="/auth/sign-up"
                className="text-primary hover:underline transition-all duration-200 hover:text-primary/80"
              >
                Regístrate
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
              <span>Encriptado</span>
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
