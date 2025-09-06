import { AppLayout } from "@/components/app-layout"
import { ConfigurationManager } from "@/components/configuration/configuration-manager"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }
  const { data, error } = await supabase
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
  const isAdmin = !error && (data || []).some((m) => m.rol === "admin")
  if (!isAdmin) {
    redirect("/")
  }
  return (
    <AppLayout showDelegationSelector={false}>
      <div className="space-y-4 sm:space-y-6">
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Administración del sistema</p>
        </div>
        <ConfigurationManager />
      </div>
    </AppLayout>
  )
}

