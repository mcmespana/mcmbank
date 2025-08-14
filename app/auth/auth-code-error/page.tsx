import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-destructive">Error de Autenticación</CardTitle>
          <CardDescription>
            Hubo un problema al procesar tu solicitud de autenticación. Esto puede ocurrir si el enlace ha expirado o ya
            ha sido utilizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Por favor, intenta iniciar sesión nuevamente o contacta con el soporte si el problema persiste.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/auth/login">Volver al Login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/sign-up">Crear Cuenta</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
