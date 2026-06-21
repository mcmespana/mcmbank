import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import type { Database } from "@/lib/types/database"

type PendingCookie = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Cliente Supabase para Route Handlers que devuelven una redirección.
 *
 * En un route handler, las cookies que Supabase escribe al refrescar la sesión
 * (`setAll`) NO se trasladan automáticamente a un `NextResponse.redirect(...)`
 * creado a mano: se pierden y el usuario acaba deslogueado. Aquí capturamos esas
 * cookies y exponemos `applyCookies(res)` para volcarlas sobre la respuesta final.
 */
export async function createRouteClient() {
  const store = await cookies()
  const pending: PendingCookie[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          for (const c of cookiesToSet) {
            pending.push(c as PendingCookie)
            try {
              store.set(c.name, c.value, c.options)
            } catch {
              // ignorable: se aplicará vía applyCookies sobre la respuesta
            }
          }
        },
      },
    },
  )

  const applyCookies = (res: NextResponse) => {
    for (const c of pending) res.cookies.set(c.name, c.value, c.options as never)
  }

  return { supabase, applyCookies }
}
