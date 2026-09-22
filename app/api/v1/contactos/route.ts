import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { crearContacto, listContactos } from "@/lib/api/catalogos"
import { conApi, cuerpoJson, qBooleano, qLista, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/contactos?delegaciones=Sevilla&texto=merca
 *
 * Proveedores y personas.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) => {
    const contactos = await listContactos(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      texto: qTexto(params, "texto"),
      tipos: qLista(params, "tipos"),
      incluirArchivados: qBooleano(params, "incluir_archivados"),
    })
    return { total: contactos.length, contactos }
  })
}

/**
 * POST /api/v1/contactos
 *
 * Da de alta un proveedor, una persona MCM o un destinatario MCM. Los
 * proveedores son globales (se comprueba antes que no exista ya uno con ese
 * nombre); personas y destinatarios son de una delegación, así que
 * 'delegacion' es obligatoria para ellos.
 */
export async function POST(request: Request) {
  return conApi(request, "write", async ({ actorHint }) => {
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const contacto = await crearContacto(
      admin,
      {
        tipo: String(cuerpo.tipo ?? ""),
        nombre: String(cuerpo.nombre ?? ""),
        delegacion: (cuerpo.delegacion as string) ?? null,
        email: cuerpo.email as string | null,
        telefono: cuerpo.telefono as string | null,
        iban: cuerpo.iban as string | null,
        identificador_fiscal: cuerpo.identificador_fiscal as string | null,
        direccion: cuerpo.direccion as string | null,
        ciudad: cuerpo.ciudad as string | null,
        codigo_postal: cuerpo.codigo_postal as string | null,
        notas: cuerpo.notas as string | null,
        categoria_id_predeterminada: cuerpo.categoria_id_predeterminada as string | null,
      },
      actor.id,
    )

    return { contacto }
  })
}
