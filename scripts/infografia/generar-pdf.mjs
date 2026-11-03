#!/usr/bin/env node
/**
 * Genera el PDF de la infografía de subvenciones (public/info/index.html):
 * una página del PDF por cada <section class="page">, 440 px de ancho y el
 * alto exacto de cada página, sin márgenes ni cortes.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/infografia/generar-pdf.mjs [entrada.html] [salida.pdf]
 *
 * Por defecto lee public/info/index.html y escribe
 * public/info/Infografia_Subvenciones_MCM.pdf, que es el que se descarga en /info.
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

const entrada = resolve(process.argv[2] ?? "public/info/index.html")
const salida = resolve(process.argv[3] ?? "public/info/Infografia_Subvenciones_MCM.pdf")
const ANCHO = 440 // ancho de diseño en px (pensado para leer en el móvil)

const browser = await chromium.launch()
try {
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
} finally {
  await browser.close()
}
