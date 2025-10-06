"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signIn(prevState: any, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const supabase = createClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Login error:", error)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

export async function signUp(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim()
  const delegation = (formData.get("delegation") as string | null)?.trim()

  if (!email || !delegation) {
    return { error: "Necesitamos tu correo y la delegación que quieres visitar." }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return { error: "El correo no tiene pinta de ser válido. Revísalo, porfa." }
  }

  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY environment variable. Unable to send email request.")
    return {
      error:
        "No pudimos enviar tu solicitud porque el servicio de correo no está configurado. Habla con el equipo para revisarlo.",
    }
  }

  const subject = `✨ Nueva solicitud de acceso - ${delegation}`
  const html = `
    <div style="background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%); padding: 32px; font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffffdd; border-radius: 20px; box-shadow: 0 20px 45px rgba(255, 105, 180, 0.25); overflow: hidden;">
        <div style="background: #9333ea; color: #f8fafc; text-align: center; padding: 28px 24px;">
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">¡Nueva petición brillante! ✨</h1>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            Hola equipo MCM Bank,
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            <strong style="color: #7c3aed;">${email}</strong> está pidiendo acceso para la delegación
            <strong style="color: #ea580c;">${delegation}</strong>.
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            ¿Le damos la bienvenida con purpurina virtual? 💌
          </p>
          <div style="background: #fdf4ff; border-radius: 16px; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #be185d;">
              Cuando tengamos un momento, contestemos y hagamos magia.
            </p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f8fafc; font-size: 14px; color: #6b7280;">
          Enviado automáticamente desde el portal de acceso chulísimo de MCM Bank ✨
        </div>
      </div>
    </div>
  `

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MCM Bank Accesos <no-reply@movimientoconsolacion.com>",
        to: ["ajmcm@movimientoconsolacion.com"],
        subject,
        html,
        reply_to: [email],
      }),
    })

    if (!response.ok) {
      const errorMessage = await response.text()
      console.error("Error sending access request email:", errorMessage)
      return { error: "No pudimos enviar tu solicitud. Inténtalo de nuevo en un ratito." }
    }

    return {
      success: "¡Solicitud enviada! Nos lo tomamos con calma, así que paciencia que ya te diremos algo.",
    }
  } catch (error) {
    console.error("Sign up request error:", error)
    return { error: "Algo ha fallado al enviar tu solicitud. Prueba otra vez en unos minutos." }
  }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}
