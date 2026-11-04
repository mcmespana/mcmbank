#!/usr/bin/env node
/**
 * Sube las descargas de /info a la carpeta de Drive de las infografías,
 * reemplazando el contenido si el archivo ya existe (mismo id, mismo enlace,
 * y Drive guarda el historial de versiones) o creándolo si no.
 *
 * Uso (desde la raíz del repo, después de generar-pdf.mjs):
 *   node scripts/infografia/subir-drive.mjs          # sube
 *   node scripts/infografia/subir-drive.mjs --dry    # solo dice qué haría
 *
 * Credenciales: la cuenta de servicio de GOOGLE_SA_CLIENT_EMAIL /
 * GOOGLE_SA_PRIVATE_KEY. Tiene que estar añadida a la carpeta como
 * «Gestor de contenido» (o «Colaborador»); con «Lector» solo puede listar.
 *
 * No borra nada en Drive y no toca los archivos que no están en la lista.
 */
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const CARPETA = "1K72Qhfw9kPMC0t87bx0Yz454QLJHEbd7" // 100. Infografías Gestión económica
const DIR = resolve("public/info")
// archivo del repo → nombre en Drive
const ARCHIVOS = [
  ["Infografia_Subvenciones_MCM.pdf", "Infografia Subvenciones MCM (vertical).pdf", "application/pdf"],
  ["Infografia_Subvenciones_MCM_16x9.pdf", "Infografia Subvenciones MCM 16x9.pdf", "application/pdf"],
  ["Infografia_Subvenciones_MCM_16x9.png", "Infografia Subvenciones MCM 16x9.png", "image/png"],
  ["infografia-subvenciones.md", "infografia-subvenciones.md", "text/markdown"],
  ["index.html", "infografia-subvenciones.html", "text/html"],
  ["horizontal.html", "infografia-subvenciones-16x9.html", "text/html"],
]
const dry = process.argv.includes("--dry")

const email = process.env.GOOGLE_SA_CLIENT_EMAIL
const key = (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n")
if (!email || !key) {
  console.error("Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY")
  process.exit(1)
}

async function token() {
  const b64u = (x) => Buffer.from(x).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64u(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${claim}`), key).toString("base64url")
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claim}.${sig}`,
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`Token: ${j.error} ${j.error_description ?? ""}`)
  return j.access_token
}

const API = "https://www.googleapis.com/drive/v3/files"
const UP = "https://www.googleapis.com/upload/drive/v3/files"
const tk = await token()
const auth = { authorization: `Bearer ${tk}` }

const q = encodeURIComponent(`'${CARPETA}' in parents and trashed=false`)
const lr = await fetch(`${API}?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=200&fields=files(id,name)`, { headers: auth })
if (!lr.ok) throw new Error(`No puedo listar la carpeta (${lr.status}): ${await lr.text()}`)
const existentes = new Map((await lr.json()).files.map((f) => [f.name, f.id]))

const fr = await fetch(`${API}/${CARPETA}?supportsAllDrives=true&fields=capabilities(canAddChildren)`, { headers: auth })
const puede = (await fr.json()).capabilities?.canAddChildren
if (!puede) console.warn(`⚠️  ${email} no puede escribir en la carpeta: añádela como «Gestor de contenido».`)

for (const [local, nombre, tipo] of ARCHIVOS) {
  const datos = await readFile(resolve(DIR, local))
  const id = existentes.get(nombre)
  const accion = id ? "actualizar" : "crear"
  if (dry || !puede) {
    console.log(`${dry ? "[dry] " : "[sin permiso] "}${accion}: ${nombre} (${(datos.length / 1024).toFixed(0)} KB)`)
    continue
  }
  let r
  if (id) {
    r = await fetch(`${UP}/${id}?uploadType=media&supportsAllDrives=true&fields=id,name,webViewLink`, {
      method: "PATCH",
      headers: { ...auth, "content-type": tipo },
      body: datos,
    })
  } else {
    const limite = "mcm" + crypto.randomBytes(8).toString("hex")
    const meta = JSON.stringify({ name: nombre, parents: [CARPETA], mimeType: tipo })
    const cuerpo = Buffer.concat([
      Buffer.from(`--${limite}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\ncontent-type: ${tipo}\r\n\r\n`),
      datos,
      Buffer.from(`\r\n--${limite}--`),
    ])
    r = await fetch(`${UP}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`, {
      method: "POST",
      headers: { ...auth, "content-type": `multipart/related; boundary=${limite}` },
      body: cuerpo,
    })
  }
  if (!r.ok) {
    console.error(`✗ ${nombre}: ${r.status} ${(await r.text()).slice(0, 300)}`)
    process.exitCode = 1
    continue
  }
  const f = await r.json()
  console.log(`✓ ${accion === "crear" ? "creado" : "actualizado"}: ${f.name} → ${f.webViewLink}`)
}
