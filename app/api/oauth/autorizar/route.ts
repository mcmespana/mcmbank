import { NextResponse } from "next/server"
import { origenDe } from "@/lib/oauth/config"
import {
  urlDeError,
  urlDeExito,
  validarAutorizacion,
  type ParametrosAutorizacion,
} from "@/lib/oauth/autorizacion"
import { usuarioActual } from "@/lib/oauth/sesion"
import { crearCodigo } from "@/lib/oauth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/oauth/autorizar — resuelve la pantalla de consentimiento.
 *
 * Vuelve a validar **todo** desde cero (parámetros, cliente, dirección de
 * retorno, sesión y rol) en vez de fiarse de los campos ocultos del formulario:
 * un formulario es solo una sugerencia del navegador.
 *
 * La protección contra peticiones desde otro sitio la da la cookie de sesión de
 * Supabase, que es `SameSite=Lax` y por tanto no viaja en un POST cross-site.
 */
export async function POST(request: Request) {
  const formulario = await request.formData()
  const params: ParametrosAutorizacion = {}
  for (const clave of [
    "client_id",
    "redirect_uri",
    "response_type",
    "code_challenge",
    "code_challenge_method",
    "scope",
    "state",
    "resource",
  ] as const) {
    const valor = formulario.get(clave)
    if (typeof valor === "string" && valor) params[clave] = valor
  }

  const validacion = await validarAutorizacion(params, origenDe(request))

  if (!validacion.ok && validacion.tipo === "fatal") {
    return NextResponse.json({ ok: false, error: validacion.mensaje }, { status: 400 })
  }
  if (!validacion.ok) {
    return NextResponse.redirect(urlDeError(validacion), 303)
  }

  const usuario = await usuarioActual()
  if (!usuario) {
    return NextResponse.redirect(
      urlDeError({
        ok: false,
        tipo: "redirigible",
        redirectUri: validacion.redirectUri,
        error: "access_denied",
        descripcion: "La sesión de MCM Bank ha caducado. Vuelve a intentarlo.",
        state: validacion.state,
      }),
      303,
    )
  }

  if (!usuario.esGestorCentral) {
    return NextResponse.redirect(
      urlDeError({
        ok: false,
        tipo: "redirigible",
        redirectUri: validacion.redirectUri,
        error: "access_denied",
        descripcion: "Esa cuenta no es de la oficina técnica y no puede autorizar este conector.",
        state: validacion.state,
      }),
      303,
    )
  }

  if (formulario.get("decision") !== "aprobar") {
    return NextResponse.redirect(
      urlDeError({
        ok: false,
        tipo: "redirigible",
        redirectUri: validacion.redirectUri,
        error: "access_denied",
        descripcion: "La conexión se ha cancelado.",
        state: validacion.state,
      }),
      303,
    )
  }

  const codigo = await crearCodigo({
    clientId: validacion.cliente.client_id,
    usuarioId: usuario.id,
    redirectUri: validacion.redirectUri,
    codeChallenge: validacion.codeChallenge,
    scopes: validacion.scopes,
    resource: validacion.resource,
  })

  return NextResponse.redirect(
    urlDeExito(validacion.redirectUri, codigo, validacion.state),
    303,
  )
}
