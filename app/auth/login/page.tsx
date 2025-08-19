import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import LoginForm from "@/components/auth/login-form"
import AnimatedBackground from "@/components/auth/animated-background"

export default async function LoginPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user is logged in, redirect to home page
  if (session) {
    redirect("/")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <LoginForm />
      </div>

      <div className="absolute top-0 left-0 h-32 w-32 bg-gradient-to-br from-primary/5 to-transparent rounded-br-full"></div>
      <div className="absolute bottom-0 right-0 h-32 w-32 bg-gradient-to-tl from-primary/5 to-transparent rounded-tl-full"></div>
    </div>
  )
}
