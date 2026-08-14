import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { borrarLogoDeStorage, guardarLogoManual, resolverLogoProveedor } from "@/lib/services/logo-proveedor"

// Los únicos valores de `rol_usuario` que escriben. `solo_lectura` no entra.
const ROLES_ESCRITURA = ["tesorero", "gestor_central"]

/**
 * Logo de un contacto: `POST` lo busca en la web del proveedor y lo guarda,
 * `DELETE` lo quita.
 *
 * La descarga tiene que pasar por el servidor por tres razones: el navegador no
 * puede leer un favicon de otro dominio (CORS), el archivo se guarda en nuestro
 * Storage con el service role, y así una sola descarga vale para todos en lugar
 * de una por persona que abra la pantalla.
 */

/** ¿Puede esta persona tocar la ficha? Devuelve el motivo si no. */
async function comprobarPermiso(contactoId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "No autorizado", status: 401 as const }

  // RLS limita esta lectura a los contactos que la persona puede ver, así que
  // un contacto que no le corresponde llega aquí como "no encontrado".
  const { data: contacto } = await (supabase as any)
    .from("contacto")
    .select("id, delegacion_id, es_global, logo_url")
    .eq("id", contactoId)
    .maybeSingle()

  if (!contacto) return { error: "Contacto no encontrado", status: 404 as const }

  const { data: membresias } = await (supabase as any)
    .from("membresia")
    .select("rol, delegacion_id")
    .eq("usuario_id", user.id)

  const roles: Array<{ rol: string; delegacion_id: string | null }> = membresias ?? []
  const esGestorCentral = roles.some((m) => m.rol === "gestor_central")

  const puede = contacto.es_global
    ? // Un contacto global lo comparten todas las delegaciones: basta con poder
      // escribir en alguna. Quien lleva la tesorería de una delegación es quien
      // sabe si el logo de Mercadona está bien.
      esGestorCentral || roles.some((m) => ROLES_ESCRITURA.includes(m.rol))
    : esGestorCentral ||
      roles.some((m) => m.delegacion_id === contacto.delegacion_id && ROLES_ESCRITURA.includes(m.rol))

  if (!puede) return { error: "No tienes permiso para editar este contacto", status: 403 as const }

  return { contacto }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const permiso = await comprobarPermiso(id)
  if ("error" in permiso) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.status })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // Sin cuerpo también vale: se busca con lo que ya tiene la ficha.
  }

  try {
    const resultado = await resolverLogoProveedor(id, {
      dominio: typeof body?.dominio === "string" ? body.dominio : null,
      forzar: body?.forzar === true,
      // Solo se adivina el dominio cuando alguien pulsa el botón y ve el
      // resultado: en el alta automática, un dominio inventado podría colarle
      // al proveedor el logo de otra empresa.
      especular: body?.especular === true || body?.forzar === true,
    })

    if (!resultado.encontrado) {
      return NextResponse.json(
        {
          error:
            "No se ha encontrado ningún logo. Escribe la web del proveedor en su ficha o sube el logo a mano.",
          intentados: resultado.intentados,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    console.error("Error resolviendo el logo del proveedor:", error)
    return NextResponse.json({ error: "No se pudo buscar el logo" }, { status: 500 })
  }
}

/** Sube un logo a mano (multipart, campo `archivo`). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const permiso = await comprobarPermiso(id)
  if ("error" in permiso) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.status })
  }

  try {
    const formData = await req.formData()
    const archivo = formData.get("archivo")

    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "No has adjuntado ningún archivo" }, { status: 400 })
    }

    const bytes = new Uint8Array(await archivo.arrayBuffer())
    const resultado = await guardarLogoManual(id, bytes)

    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    console.error("Error subiendo el logo del proveedor:", error)
    // El mensaje de `guardarLogoManual` explica qué falta (formato, tamaño), así
    // que se devuelve tal cual: es accionable.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el logo" },
      { status: 400 },
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const permiso = await comprobarPermiso(id)
  if ("error" in permiso) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.status })
  }

  try {
    const admin = createAdminClient() as any
    const { error } = await admin
      .from("contacto")
      .update({ logo_url: null, logo_fuente: null, logo_actualizado_en: null })
      .eq("id", id)

    if (error) throw new Error(error.message)

    await borrarLogoDeStorage(permiso.contacto.logo_url)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error quitando el logo del proveedor:", error)
    return NextResponse.json({ error: "No se pudo quitar el logo" }, { status: 500 })
  }
}
