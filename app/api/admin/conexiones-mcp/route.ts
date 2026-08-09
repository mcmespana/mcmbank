import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Conexiones MCP activas: qué aplicaciones han recibido acceso por OAuth, de
 * quién y desde cuándo.
 *
 * Existe para que la promesa de la pantalla de consentimiento —"puedes
 * retirarle el acceso cuando quieras"— sea verdad sin abrir la base de datos.
 * Solo para gestores centrales, igual que el resto de `/api/admin`.
 */
export async function GET() {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const admin = createAdminClient()

    const { data: tokens, error } = await (admin as any)
      .from("mcp_oauth_token")
      .select("client_id, usuario_id, scope, creado_en, ultimo_uso_en, expira_en, tipo")
      .is("revocado_en", null)
      .gt("expira_en", new Date().toISOString())
      .order("creado_en", { ascending: false })
      .limit(500)

    if (error) {
      console.error("conexiones MCP: error listando tokens:", error)
      return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
    }

    const filas = (tokens ?? []) as any[]
    if (filas.length === 0) return NextResponse.json({ conexiones: [] })

    const [{ data: clientes }, { data: usuarios }, { data: perfiles }] = await Promise.all([
      (admin as any)
        .from("mcp_oauth_cliente")
        .select("client_id, nombre")
        .in("client_id", [...new Set(filas.map((f) => f.client_id))]),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      (admin as any)
        .from("perfil")
        .select("usuario_id, nombre_completo")
        .in("usuario_id", [...new Set(filas.map((f) => f.usuario_id))]),
    ])

    const nombreCliente = new Map((clientes ?? []).map((c: any) => [c.client_id, c.nombre]))
    const emailUsuario = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]))
    const nombreUsuario = new Map(
      (perfiles ?? []).map((p: any) => [p.usuario_id, p.nombre_completo?.trim() || null]),
    )

    // Una conexión = una aplicación autorizada por una persona. Se agrupan los
    // tokens (acceso + refresco, y las renovaciones) para no enseñar una lista
    // ilegible de secretos rotados.
    const porConexion = new Map<string, any>()
    for (const fila of filas) {
      const clave = `${fila.client_id}::${fila.usuario_id}`
      const previa = porConexion.get(clave)
      const usoFila = fila.ultimo_uso_en ?? null

      if (!previa) {
        porConexion.set(clave, {
          client_id: fila.client_id,
          usuario_id: fila.usuario_id,
          aplicacion: nombreCliente.get(fila.client_id) ?? "Aplicación desconocida",
          usuario: nombreUsuario.get(fila.usuario_id) ?? emailUsuario.get(fila.usuario_id) ?? fila.usuario_id,
          scope: fila.scope,
          conectado_en: fila.creado_en,
          ultimo_uso_en: usoFila,
          tokens: 1,
        })
        continue
      }

      previa.tokens += 1
      if (fila.creado_en < previa.conectado_en) previa.conectado_en = fila.creado_en
      if (usoFila && (!previa.ultimo_uso_en || usoFila > previa.ultimo_uso_en)) {
        previa.ultimo_uso_en = usoFila
      }
    }

    return NextResponse.json({ conexiones: [...porConexion.values()] })
  } catch (err) {
    console.error("conexiones MCP: error inesperado:", err)
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/conexiones-mcp — retira el acceso de una aplicación.
 *
 * Revoca de golpe todos los tokens de ese cliente para ese usuario: el
 * asistente deja de tener acceso en la siguiente llamada, sin esperar a que
 * caduque nada.
 */
export async function DELETE(request: Request) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("client_id")
    const usuarioId = searchParams.get("usuario_id")

    if (!clientId || !usuarioId) {
      return NextResponse.json(
        { error: "Faltan 'client_id' y 'usuario_id'." },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { error } = await (admin as any)
      .from("mcp_oauth_token")
      .update({ revocado_en: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("usuario_id", usuarioId)
      .is("revocado_en", null)

    if (error) {
      console.error("conexiones MCP: error revocando:", error)
      return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("conexiones MCP: error inesperado al revocar:", err)
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
  }
}
