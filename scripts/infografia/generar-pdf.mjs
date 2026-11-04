#!/usr/bin/env node
/**
 * Genera las descargas de la infografía de subvenciones (public/info/):
 *
 *  - Vertical  (index.html)      → Infografia_Subvenciones_MCM.pdf
 *    una página por cada <section class="page">, 440 px de ancho y el alto
 *    exacto de cada página, sin márgenes ni cortes.
 *  - Horizontal (horizontal.html) → Infografia_Subvenciones_MCM_16x9.pdf (vectorial)
 *                                 + Infografia_Subvenciones_MCM_16x9.png (3840×2160)
 *    lienzo fijo de 2400×1350 px.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/infografia/generar-pdf.mjs
 *
 * Requisitos: Playwright con Chromium. Si no lo tienes:
 *   pnpm dlx playwright install chromium   (y ejecuta con NODE_PATH apuntando a él)
 * o simplemente: npx -y -p playwright node scripts/infografia/generar-pdf.mjs
 *
 * Cómo funciona: mide el alto de cada página y le asigna una página CSS con
 * nombre (@page pN { size: 440px <alto>px }). Chromium respeta un tamaño
 * distinto por página, así que sale un único PDF sin tener que unir nada.
 */
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require("playwright"))
} catch {
  console.error("No encuentro Playwright. Prueba con: npx -y -p playwright node scripts/infografia/generar-pdf.mjs")
  process.exit(1)
}

const DIR = resolve("public/info")
const entrada = resolve(DIR, "index.html")
const salida = resolve(DIR, "Infografia_Subvenciones_MCM.pdf")
const ANCHO = 440 // ancho de diseño en px (pensado para leer en el móvil)
const H_ENTRADA = resolve(DIR, "horizontal.html")
const H_BASE = resolve(DIR, "Infografia_Subvenciones_MCM_16x9")
const [HW, HH] = [2400, 1350] // lienzo del HTML horizontal

const browser = await chromium.launch()
try {
  // ---- Vertical ----
  const page = await browser.newPage({ viewport: { width: ANCHO, height: 900 } })
  await page.goto(pathToFileURL(entrada).href, { waitUntil: "networkidle" })
  await page.emulateMedia({ media: "print" })
  await page.evaluate(() => document.fonts.ready)

  const altos = await page.evaluate(() =>
    [...document.querySelectorAll(".page")].map((el) => Math.ceil(el.getBoundingClientRect().height)),
  )
  const css = altos
    .map(
      (h, i) =>
        `@page p${i + 1}{size:${ANCHO}px ${h}px;margin:0}` +
        `.page:nth-of-type(${i + 1}){page:p${i + 1};break-after:${i === altos.length - 1 ? "auto" : "page"}}`,
    )
    .join("\n")
  await page.addStyleTag({ content: css })

  await page.pdf({ path: salida, preferCSSPageSize: true, printBackground: true })
  altos.forEach((h, i) => console.log(`Página ${i + 1}: ${h}px de alto`))
  console.log(`PDF generado: ${salida}`)

  // ---- Horizontal 16:9 ----
  const h = await browser.newPage({ viewport: { width: HW, height: HH }, deviceScaleFactor: 3840 / HW })
  await h.goto(pathToFileURL(H_ENTRADA).href, { waitUntil: "networkidle" })
  await h.emulateMedia({ media: "print" })
  await h.evaluate(() => document.fonts.ready)
  // Si algo se sale del lienzo, se corta sin avisar: mejor avisar aquí
  const cortes = await h.evaluate(() =>
    [...document.querySelectorAll(".canvas .panel, .canvas .foot")]
      .filter((el) => el.scrollHeight > el.clientHeight + 12)
      .map((el) => (el.querySelector("h2, h3, .fn, b")?.textContent || el.className).trim().slice(0, 40)),
  )
  if (cortes.length) console.warn(`⚠️  En 16:9 no cabe todo en: ${cortes.join(" · ")}`)
  await h.locator(".canvas").screenshot({ path: `${H_BASE}.png` })
  await h.pdf({ path: `${H_BASE}.pdf`, width: `${HW}px`, height: `${HH}px`, printBackground: true, pageRanges: "1" })
  console.log(`PDF y PNG 16:9 generados: ${H_BASE}.pdf / .png`)
} finally {
  await browser.close()
}
