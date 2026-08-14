import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolverLogoProveedor } from "@/lib/services/logo-proveedor"

// Los únicos valores de `rol_usuario` que escriben. `solo_lectura` no entra.
const ROLES_ESCRITURA = ["tesorero", "gestor_central"]

/**
 * Busca de una vez el logo de los proveedores que no tienen ninguno.
 *
 * Existe porque los proveedores de antes de esta función se quedaron sin logo, y
 * abrir cada ficha para pulsar un botón no es trabajo de nadie.
 */

/** Tope por llamada: por encima, la función serverless se queda sin tiempo. */
const MAXIMO_POR_LLAMADA = 20

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { data: membresias } = await (supabase as any)
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)

  const puedeEscribir = (membresias ?? []).some((m: { rol: string }) => ROLES_ESCRITURA.includes(m.rol))
  if (!puedeEscribir) {
    return NextResponse.json({ error: "No tienes permiso para editar contactos" }, { status: 403 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // Sin cuerpo: se buscan los de todas las delegaciones que la persona vea.
  }

  const delegacionId = typeof body?.delegacionId === "string" ? body.delegacionId : null

  // La lectura va con la sesión de la persona, así que RLS decide qué
  // proveedores entran: nadie puede lanzar la búsqueda sobre fichas ajenas.
  let query = (supabase as any)
    .from("contacto")
    .select("id, nombre")
    .eq("tipo", "proveedor")
    .eq("archivado", false)
    .is("logo_url", null)
    .limit(MAXIMO_POR_LLAMADA)

  if (delegacionId) {
    query = query.or(`delegacion_id.eq.${delegacionId},es_global.eq.true`)
  }

  const { data: pendientes, error } = await query

  if (error) {
    console.error("Error listando proveedores sin logo:", error)
    return NextResponse.json({ error: "No se pudieron listar los proveedores" }, { status: 500 })
  }

  const candidatos: Array<{ id: string; nombre: string }> = pendientes ?? []

  // En serie a propósito: son cuatro fuentes por proveedor y lanzarlas todas a
  // la vez es la forma más rápida de que unavatar nos limite por abuso.
  const resueltos: string[] = []
  const fallidos: string[] = []

  for (const contacto of candidatos) {
    try {
      // Sin especular: en masa nadie está mirando el resultado, y un dominio
      // inventado le pondría a un proveedor el logo de otra empresa.
      const resultado = await resolverLogoProveedor(contacto.id)
      if (resultado.encontrado) resueltos.push(contacto.nombre)
      else fallidos.push(contacto.nombre)
    } catch (err) {
      console.error(`Error resolviendo el logo de ${contacto.nombre}:`, err)
      fallidos.push(contacto.nombre)
    }
  }

  return NextResponse.json({
    ok: true,
    revisados: candidatos.length,
    resueltos,
    fallidos,
    // Avisa de que quedan más para que quien llama pueda repetir.
    quedanMas: candidatos.length === MAXIMO_POR_LLAMADA,
  })
}
