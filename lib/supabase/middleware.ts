import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

// Only protect specific routes, not everything.
// NOTE: this list is for page routes only. It does not distinguish page
// routes from API routes (an unauthenticated match here gets redirected to
// /auth/login, which is wrong for an API response) — /api/admin and
// /api/supabase-sanity are intentionally NOT listed here; they are guarded
// server-side by requireAdmin() in their own route handlers instead.
const protectedRoutes = [
  "/transacciones", "/categorias", "/cuentas", "/delegaciones",
  "/movimientos", "/contactos", "/pagos-mcm", "/facturas",
  "/configuracion", "/propuestas", "/informes",
]

// El dashboard va aparte porque con `startsWith` un "/" en la lista de arriba
// protegería la aplicación entera, incluidas `/auth/*` y las rutas públicas, y
// el redirect a login se comería a sí mismo.
const isDashboardRoute = (pathname: string) => pathname === "/" || pathname === ""

export async function updateSession(request: NextRequest) {
  const isProtectedRoute =
    isDashboardRoute(request.nextUrl.pathname) ||
    protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // If Supabase is not configured, fail closed on protected routes (a
  // misconfigured deployment must not silently let requests through
  // unauthenticated) but keep public/auth pages renderable so the
  // misconfiguration is at least visible/debuggable.
  if (!isSupabaseConfigured) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("error", "config")
      return NextResponse.redirect(url)
    }
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables not found")
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth")

  if (isProtectedRoute && !user) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // If user is logged in and trying to access auth pages, redirect to home
  if (user && isAuthRoute && !request.nextUrl.pathname.includes("/callback")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies, like so: response.cookies.setAll(supabaseResponse.cookies.getAll())

  return supabaseResponse
}
