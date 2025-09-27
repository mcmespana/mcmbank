"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ShieldCheck, Sparkles, Stars } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

const MIN_PASSWORD_LENGTH = 6

const passwordBlueprint = [
  {
    id: "length",
    label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres (requisito actual)`,
    optional: false,
    test: (password: string) => password.trim().length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "uppercase",
    label: "Una mayúscula para cuando nos pongamos exquisitos",
    optional: true,
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "Un número como guiño futurista",
    optional: true,
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "Un símbolo con personalidad (opcional)",
    optional: true,
    test: (password: string) => /[^\w\s]/.test(password),
  },
] as const

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, {
      message: `Tu nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    }),
    confirmPassword: z.string().min(1, {
      message: "Confirma tu nueva contraseña",
    }),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export function ChangePasswordPage() {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const newPasswordValue = watch("newPassword")

  const requirements = useMemo(() => {
    return passwordBlueprint.map(requirement => ({
      ...requirement,
      met: requirement.test(newPasswordValue ?? ""),
    }))
  }, [newPasswordValue])

  const activeRequirementCount = requirements.filter(req => !req.optional).length || 1
  const fulfilledActiveRequirementCount = requirements.filter(req => !req.optional && req.met).length
  const progress = Math.min(100, Math.round((fulfilledActiveRequirementCount / activeRequirementCount) * 100))

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase.auth.updateUser({ password: values.newPassword })
      if (error) {
        throw error
      }
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" })
      toast.success("Contraseña actualizada", {
        description: "Tu nueva clave ya está lista para seguir conquistando el banco más bonito.",
      })
    } catch (error: any) {
      console.error("Error updating password", error)
      toast.error("No hemos podido actualizar tu contraseña", {
        description: error?.message ?? "Inténtalo de nuevo en unos segundos.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative isolate -mx-2 -mt-2 rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/50 px-4 py-12 shadow-[0px_40px_120px_-40px_rgba(15,23,42,0.45)] sm:-mx-4 lg:-mx-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-x-16 top-1/2 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="space-y-4 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-3 w-3" />
            Reset mágico
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Reinventa tu contraseña con un ritual de lujo
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg lg:max-w-2xl">
            Dale a tu cuenta un aire nuevo en una experiencia cuidada al detalle. Por ahora solo necesitas una clave de {MIN_PASSWORD_LENGTH} caracteres, pero hemos preparado el terreno para cuando queramos subir el listón.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/95 p-8 shadow-[0px_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-10"
          >
            <div className="absolute -right-20 -top-32 h-56 w-56 rotate-12 rounded-full bg-gradient-to-br from-primary/60 via-indigo-500/60 to-transparent blur-3xl" />
            <div className="absolute -left-24 bottom-12 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />

            <div className="relative z-10 space-y-8">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-xs uppercase tracking-[0.35em] text-muted-foreground">
                {user?.email ? `Sesión iniciada como ${user.email}` : "Sesión segura activa"}
              </div>

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword" className="text-sm font-semibold text-foreground">
                    Contraseña actual
                    <span className="ml-2 text-xs font-normal uppercase tracking-[0.2em] text-muted-foreground">
                      opcional por ahora
                    </span>
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    placeholder="La pediremos cuando nos pongamos exigentes"
                    {...register("currentPassword")}
                    className="h-12 rounded-2xl border-border/70 bg-background/80 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hoy no la necesitamos, pero ya está aquí para el futuro.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-foreground">
                    Nueva contraseña
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Un secreto a tu altura"
                    {...register("newPassword")}
                    className={cn(
                      "h-12 rounded-2xl border-border/70 bg-background/80 text-base",
                      errors.newPassword && "border-destructive/60 focus-visible:ring-destructive/60",
                    )}
                  />
                  {errors.newPassword && (
                    <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground">
                    Confirmar contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repetimos para asegurarnos"
                    {...register("confirmPassword")}
                    className={cn(
                      "h-12 rounded-2xl border-border/70 bg-background/80 text-base",
                      errors.confirmPassword && "border-destructive/60 focus-visible:ring-destructive/60",
                    )}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                    <span>Progreso imprescindible</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <ul className="grid gap-2 text-sm">
                  {requirements.map(requirement => (
                    <li
                      key={requirement.id}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border border-transparent bg-muted/40 px-4 py-3 text-sm",
                        requirement.met
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-900 dark:text-emerald-100"
                          : "text-muted-foreground",
                        requirement.optional && !requirement.met && "opacity-75",
                      )}
                    >
                      <ShieldCheck
                        className={cn(
                          "mt-0.5 h-4 w-4 flex-shrink-0",
                          requirement.met ? "text-emerald-500" : "text-muted-foreground/60",
                        )}
                      />
                      <div>
                        <p className="font-medium leading-none">
                          {requirement.label}
                          {requirement.optional && !requirement.met && (
                            <span className="ml-2 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground/70">
                              futuro
                            </span>
                          )}
                        </p>
                        {requirement.optional && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {requirement.met
                              ? "Listo para el futuro."
                              : "Sin presión: lo tendremos en cuenta cuando toque."}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="group relative h-12 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-base font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-[0_25px_45px_-20px_rgba(168,85,247,0.45)]"
              >
                <span className="relative z-10">
                  {isSubmitting ? "Guardando tu nueva contraseña..." : "Guardar nueva contraseña"}
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 opacity-0 transition group-hover:opacity-100" />
              </Button>
            </div>
          </form>

          <aside className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/80 p-6 shadow-[0px_30px_80px_-50px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:p-8">
            <div className="absolute -right-16 top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -left-10 bottom-10 h-32 w-32 rounded-full bg-pink-400/20 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <Stars className="h-3 w-3" />
                Nota de estilo
              </div>
              <p className="text-lg font-semibold text-foreground">
                Una experiencia diseñada para quienes cuidan cada detalle.
              </p>
              <p className="text-sm text-muted-foreground">
                Sin complicaciones innecesarias hoy, pero con la arquitectura preparada para protocolos más exigentes mañana. Cada campo, animación y color están listos para crecer contigo.
              </p>
              <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">¿Qué ocurrirá cuando pulses guardar?</p>
                <ul className="mt-3 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Actualizamos tu contraseña al instante mediante Supabase.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>Te confirmamos el cambio con un mensaje brillante.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-pink-400" />
                    <span>Preparado para añadir nuevas reglas de seguridad sin rehacer la UI.</span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
