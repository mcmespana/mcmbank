import type { createAdminClient } from "@/lib/supabase/admin"
import { ApiError, misconfigured, notFound } from "@/lib/api/errors"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Quién firma las escrituras hechas desde fuera de la app.
 *
 * La API externa se autentica con una clave compartida, no con una sesión de
 * usuario, pero la base de datos sí exige un autor (`aviso.creado_por`,
 * `movimiento_archivo.subido_por`, `factura.creado_por`…) y las personas que
 * leen esos avisos quieren ver un nombre, no "sistema". Por eso toda escritura
 * se atribuye a un usuario real:
 *
 *   1. `usuario_id` / `usuario_email` que llegue en la propia llamada
 *      (el admin multidelegación puede firmar con su cuenta), o
 *   2. las variables de entorno `MCM_API_USER_ID` / `MCM_API_USER_EMAIL`
 *      (la cuenta "oficina técnica" que firma por defecto).
 *
 * Si no hay ninguna de las dos, la escritura falla con un mensaje que explica
 * exactamente qué configurar. Nunca se elige un usuario "cualquiera": una nota
 * firmada por la persona equivocada es peor que una nota que no se guarda.
 */

export interface Actor {
  id: string
  nombre: string | null
  email: string | null
}

/** Pistas de autoría que puede enviar el cliente en cada escritura. */
export interface ActorHint {
  usuario_id?: string | null
  usuario_email?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor)
}

/**
 * Cache de email → usuario. `auth.admin.listUsers` es una llamada cara (lista
 * todos los usuarios), así que se memoriza durante la vida del proceso; los
 * emails de una cuenta cambian muy rara vez y un fallo de cache solo implica
 * un error "no encontrado" que se resuelve en el siguiente arranque.
 */
let usuariosCache: { cargadoEn: number; porEmail: Map<string, Actor>; porId: Map<string, Actor> } | null =
  null
const USUARIOS_TTL_MS = 5 * 60 * 1000

async function cargarUsuarios(admin: AdminClient) {
  if (usuariosCache && Date.now() - usuariosCache.cargadoEn < USUARIOS_TTL_MS) {
    return usuariosCache
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    throw new ApiError(500, `No se pudo consultar la lista de usuarios: ${error.message}`)
  }

  const porEmail = new Map<string, Actor>()
  const porId = new Map<string, Actor>()
  for (const u of data?.users ?? []) {
    const actor: Actor = { id: u.id, email: u.email ?? null, nombre: null }
    porId.set(u.id, actor)
    if (u.email) porEmail.set(u.email.toLowerCase(), actor)
  }

  usuariosCache = { cargadoEn: Date.now(), porEmail, porId }
  return usuariosCache
}

/** Completa el nombre del actor desde `perfil` (decorativo: no bloquea). */
async function conNombre(admin: AdminClient, actor: Actor): Promise<Actor> {
  const { data } = await (admin as any)
    .from("perfil")
    .select("nombre_completo")
    .eq("usuario_id", actor.id)
    .maybeSingle()
  return { ...actor, nombre: data?.nombre_completo?.trim() || null }
}

/**
 * Resuelve el usuario al que se atribuyen las escrituras de esta llamada.
 * Lanza `ApiError` con instrucciones concretas si no hay forma de determinarlo.
 */
export async function resolveActor(admin: AdminClient, hint?: ActorHint): Promise<Actor> {
  const idExplicito = hint?.usuario_id?.trim() || process.env.MCM_API_USER_ID?.trim() || null
  const emailExplicito =
    hint?.usuario_email?.trim() || process.env.MCM_API_USER_EMAIL?.trim() || null

  if (idExplicito) {
    if (!esUuid(idExplicito)) {
      throw new ApiError(400, `'${idExplicito}' no es un UUID de usuario válido.`)
    }
    const { porId } = await cargarUsuarios(admin)
    const actor = porId.get(idExplicito)
    if (!actor) {
      throw notFound(
        `No existe ningún usuario con el id ${idExplicito}. Comprueba MCM_API_USER_ID o el 'usuario_id' que has enviado.`,
      )
    }
    return conNombre(admin, actor)
  }

  if (emailExplicito) {
    const { porEmail } = await cargarUsuarios(admin)
    const actor = porEmail.get(emailExplicito.toLowerCase())
    if (!actor) {
      throw notFound(
        `No hay ningún usuario de MCM Bank con el correo ${emailExplicito}. Comprueba MCM_API_USER_EMAIL o el 'usuario_email' que has enviado.`,
      )
    }
    return conNombre(admin, actor)
  }

  throw misconfigured(
    "Esta operación necesita saber a qué usuario atribuirla y el servidor no tiene autor por defecto. " +
      "Define la variable de entorno MCM_API_USER_ID (o MCM_API_USER_EMAIL) con la cuenta de la oficina técnica, " +
      "o envía 'usuario_email' en la propia llamada para firmarla con tu cuenta.",
  )
}

/** Nombre legible del actor (para textos y respuestas). */
export function nombreActor(actor: Actor): string {
  return actor.nombre || actor.email || actor.id
}
