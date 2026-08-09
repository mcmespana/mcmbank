import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { AlertTriangle, KeyRound, Lock, PencilLine, Search, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { validarAutorizacion, urlDeError, type ParametrosAutorizacion } from "@/lib/oauth/autorizacion"
import { SCOPES, RUTAS } from "@/lib/oauth/config"
import { usuarioActual } from "@/lib/oauth/sesion"

export const dynamic = "force-dynamic"

/**
 * Pantalla de consentimiento de OAuth.
 *
 * Es el único punto del flujo donde interviene una persona, y de él depende
 * todo lo demás: aquí se comprueba que quien autoriza tiene sesión en MCM Bank
 * y es de la oficina técnica. El formulario no decide nada por sí mismo — el
 * POST vuelve a validarlo todo — así que da igual lo que alguien manipule en el
 * HTML.
 */

const DESCRIPCION_SCOPES: Record<string, { titulo: string; detalle: string; icono: typeof Search }> = {
  [SCOPES.LEER]: {
    titulo: "Consultar",
    detalle:
      "Movimientos, facturas, cuentas, avisos y resúmenes económicos de todas las delegaciones.",
    icono: Search,
  },
  [SCOPES.ESCRIBIR]: {
    titulo: "Modificar",
    detalle:
      "Categorizar movimientos, subir y conciliar facturas, y dejar notas y tareas a las delegaciones.",
    icono: PencilLine,
  },
}

function origenActual(cabeceras: Headers): string {
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? ""
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "https"
  return `${protocolo}://${host}`
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  )
}

export default async function AutorizarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params: ParametrosAutorizacion = Object.fromEntries(
    Object.entries(sp).map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0] : valor]),
  )

  const cabeceras = await headers()
  const origen = origenActual(cabeceras)
  const validacion = await validarAutorizacion(params, origen)

  // Falla el cliente o la dirección de retorno: no hay a dónde redirigir con
  // seguridad, así que se cuenta en pantalla.
  if (!validacion.ok && validacion.tipo === "fatal") {
    return (
      <Aviso titulo="No se puede continuar">
        <p>{validacion.mensaje}</p>
      </Aviso>
    )
  }

  // La dirección de retorno ya está verificada: el error se devuelve por ella.
  if (!validacion.ok) {
    redirect(urlDeError(validacion))
  }

  const usuario = await usuarioActual()

  if (!usuario) {
    const query = new URLSearchParams()
    for (const [clave, valor] of Object.entries(params)) {
      if (valor) query.set(clave, valor)
    }
    redirect(`/auth/login?next=${encodeURIComponent(`${RUTAS.autorizar}?${query.toString()}`)}`)
  }

  if (!usuario.esGestorCentral) {
    return (
      <Aviso titulo="Tu cuenta no puede autorizar esto">
        <p>
          Has entrado como <strong>{usuario.email}</strong>, que no es una cuenta de la oficina
          técnica.
        </p>
        <p>
          Este conector da acceso a las cuentas de <strong>todas</strong> las delegaciones, así que
          solo lo pueden autorizar los gestores centrales. Si crees que debería ser tu caso, pídelo
          al equipo técnico.
        </p>
      </Aviso>
    )
  }

  const quienAutoriza = usuario.nombre || usuario.email

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl">
            Conectar <span className="text-primary">{validacion.cliente.nombre}</span> con MCM Bank
          </CardTitle>
          <CardDescription>
            Vas a darle acceso a la tesorería de todas las delegaciones. Firmará con tu cuenta:{" "}
            <strong className="text-foreground">{quienAutoriza}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {validacion.scopes.map((scope) => {
              const info = DESCRIPCION_SCOPES[scope]
              if (!info) return null
              const Icono = info.icono
              return (
                <li key={scope} className="flex gap-3 rounded-lg border bg-card p-3">
                  <Icono className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{info.titulo}</p>
                    <p className="text-sm text-muted-foreground">{info.detalle}</p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Todo lo que haga quedará registrado a tu nombre. No podrá cambiar el importe, la fecha
              ni la cuenta de ningún movimiento: eso viene del banco. Puedes retirarle el acceso
              cuando quieras desde la configuración de MCM Bank.
            </p>
          </div>

          <form action="/api/oauth/autorizar" method="post" className="space-y-3">
            {Object.entries(params).map(([clave, valor]) =>
              valor ? <input key={clave} type="hidden" name={clave} value={valor} /> : null,
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" name="decision" value="denegar" variant="outline" className="sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" name="decision" value="aprobar" className="sm:w-auto">
                <Lock className="mr-2 h-4 w-4" />
                Autorizar conexión
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
