"use client"

import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { signIn } from "@/lib/actions/auth"
import { useFeatureFlags } from "@/lib/feature-flags"
import { delay } from "@/lib/autologin"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
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
  const featureFlags = useFeatureFlags()
  const [isAutoLogging, setIsAutoLogging] = useState(false)
  const [autoLoginTriggered, setAutoLoginTriggered] = useState(false)

  // Handle successful login by redirecting
  useEffect(() => {
    if (state?.success) {
      if (isAutoLogging) {
        // For auto-login, reload the page to properly refresh the session
        window.location.reload()
      } else {
        router.push("/")
      }
    }
  }, [state, router, isAutoLogging])

  // Handle failed auto-login
  useEffect(() => {
    if (state?.error && isAutoLogging) {
      console.error('Auto-login failed:', state.error)
      setIsAutoLogging(false)
    }
  }, [state?.error, isAutoLogging])

  // Auto-login effect when feature flag is enabled
  useEffect(() => {
    const performAutoLoginSequence = async () => {
      if (featureFlags.autologin && !isAutoLogging && !state && !autoLoginTriggered) {
        setAutoLoginTriggered(true)
        setIsAutoLogging(true)
        
        try {
          // Show "iniciando autologin" message for 1 second
          await delay(1000)
          
          // Create form data with auto-login credentials
          const formData = new FormData()
          formData.append('email', 'admin@movimientoconsolacion.com')
          formData.append('password', '1234')
          
          // Submit using the form action
          formAction(formData)
        } catch (error) {
          console.error('Auto-login error:', error)
          setIsAutoLogging(false)
        }
      }
    }

    performAutoLoginSequence()
  }, [featureFlags.autologin, isAutoLogging, state, autoLoginTriggered, formAction])

  // Show auto-login message when feature is enabled and in progress
  if (featureFlags.autologin && isAutoLogging && !state?.error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Bienvenido</CardTitle>
          <CardDescription className="text-center">MCM Bank</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-center text-sm text-muted-foreground">
              Iniciando autologin...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Bienvenido</CardTitle>
        <CardDescription className="text-center">Inicia sesión en tu cuenta de MCM Bank</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" placeholder="tu@email.com" required />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña
            </label>
            <Input id="password" name="password" type="password" required />
          </div>

          <SubmitButton />

          <div className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              Regístrate
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
