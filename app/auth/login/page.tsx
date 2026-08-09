import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import LoginForm from "@/components/auth/login-form"
import AnimatedBackground from "@/components/auth/animated-background"
import { Skeleton } from "@/components/ui/skeleton"

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Si ya hay sesión, se va directo al destino. `next` solo admite rutas
  // internas: con una URL absoluta esto sería un redirector abierto.
  if (session) {
    const { next } = await searchParams
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        {/* LoginForm lee `useSearchParams()` (mensajes de `?error=`): con la
            barrera, el fondo y la caja de la tarjeta se pintan sin esperarlo. */}
        <Suspense fallback={<Skeleton className="h-[26rem] w-full max-w-md rounded-xl" />}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="absolute top-0 left-0 h-32 w-32 bg-gradient-to-br from-primary/5 to-transparent rounded-br-full"></div>
      <div className="absolute bottom-0 right-0 h-32 w-32 bg-gradient-to-tl from-primary/5 to-transparent rounded-tl-full"></div>
    </div>
  )
}
