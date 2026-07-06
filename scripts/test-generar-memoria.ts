/**
 * Prueba REAL de generación de memoria económica.
 * Requiere:
 *   - Variables de Google en .env / .env.local
 *   - Que un usuario haya pulsado "Conectar Google" (existe fila en google_credencial)
 *
 * Uso:
 *   npx tsx scripts/test-generar-memoria.ts "MCM Castellón" curso 2024
 */
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

// --- cargar .env y .env.local manualmente ---
for (const file of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}

async function main() {
  const [, , delegArg, periodoArg, anioArg] = process.argv
  const delegNombre = delegArg || "MCM Castellón"
  const periodoTipo = (periodoArg as "curso" | "natural") || "curso"
  const anio = Number(anioArg) || 2024

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVIC_ROLE_KEY!
  if (!url || !serviceKey) throw new Error("Faltan credenciales de Supabase (service role)")

  const supabase = createClient(url, serviceKey)

  // imports dinámicos tras cargar el entorno
  const { getAuthorizedClient } = await import("../lib/services/google")
  const { buildContext, buildDefaultMapeo, generarSheet, cursoLabel } = await import(
    "../lib/services/memoria-economica"
  )

  // credencial Google más reciente
  const { data: cred } = await supabase
    .from("google_credencial")
    .select("usuario_id, email, actualizado_en")
    .order("actualizado_en", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cred) {
    console.error("❌ No hay credencial de Google. Pulsa 'Conectar Google' en la app primero.")
    process.exit(1)
  }
  console.log(`🔑 Usando credencial de: ${cred.email || cred.usuario_id}`)

  const { data: deleg } = await supabase
    .from("delegacion")
    .select("id, nombre")
    .eq("nombre", delegNombre)
    .maybeSingle()
  if (!deleg) throw new Error(`No se encontró la delegación "${delegNombre}"`)
  console.log(`🏢 Delegación: ${deleg.nombre} · periodo ${periodoTipo} ${anio}`)

  const client = await getAuthorizedClient(supabase, cred.usuario_id)
  if (!client) throw new Error("No se pudo crear el cliente de Google")

  const { data: org } = await supabase
    .from("organizacion")
    .select("plantilla_memoria_sheet_id")
    .limit(1)
    .maybeSingle()
  const templateId =
    org?.plantilla_memoria_sheet_id ||
    process.env.GOOGLE_MEMORIA_TEMPLATE_ID ||
    "1GfIWcOiJEj90Y7r_6CK8qmMrcq1lPyDi5kG0sjSWDnA"

  console.log("⏳ Construyendo contexto y mapeo…")
  const ctx = await buildContext(supabase, deleg.id, periodoTipo, anio)
  const mapeo = buildDefaultMapeo(ctx)
  const corto = deleg.nombre.replace(/^MCM\s+/i, "").trim()
  const label = periodoTipo === "curso" ? cursoLabel(anio) : String(anio)
  const titulo = `MCM ${corto} · Balance Económico ${label}`

  console.log("📋 Actividades detectadas:", mapeo.actividadesParentNombre || "(ninguna)")
  console.log("⏳ Copiando plantilla y rellenando en Google Sheets…")
  const res = await generarSheet(client, { templateId, ctx, mapeo, titulo })

  console.log("\n✅ ¡Generado!")
  console.log("   Título:", res.titulo)
  console.log("   Link:  ", res.webViewLink)
  console.log("   Remanente anterior (F3):   ", res.remanente)
  console.log("   Balance del ejercicio (F46):", res.balanceAnual)
  console.log("   Disponible final (F49):    ", res.disponibleFinal)
  console.log("   ¿Hoja = app?:", res.cuadraConHoja ? "sí ✓" : "NO ✗")
  console.log(
    "   ¿Cuadra con el saldo real?:",
    res.resumen.cuadra ? "sí ✓" : `NO (descuadre ${res.resumen.descuadre.toFixed(2)} €)`,
  )
}

main().catch((err) => {
  console.error("💥 Error:", err?.message || err)
  process.exit(1)
})
