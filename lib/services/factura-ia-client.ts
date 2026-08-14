"use client"

import type { FacturaDatosIa } from "@/lib/types/factura-ia"

/**
 * Llamadas a la lectura automática de facturas desde el navegador.
 *
 * No se habla con Supabase directamente porque el trabajo (descargar el
 * documento, llamar al modelo, crear el proveedor) necesita la clave de Gemini
 * y el cliente admin, que solo existen en el servidor. La ruta
 * `/api/facturas/ia` comprueba la sesión y el rol antes de hacer nada.
 */

async function pedir(cuerpo: Record<string, unknown>): Promise<any> {
  const respuesta = await fetch("/api/facturas/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  })
  const json = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new Error(json?.error || `Error ${respuesta.status}`)
  }
  return json
}

/** Lee (o relee) la factura con IA. Devuelve lo que se ha guardado en `datos_ia`. */
export async function leerFacturaConIa(
  facturaId: string,
  options: { forzar?: boolean } = {},
): Promise<FacturaDatosIa | null> {
  const json = await pedir({ facturaId, accion: "extraer", forzar: options.forzar === true })
  return (json?.datos_ia as FacturaDatosIa) ?? null
}

/** Acepta la categoría sugerida (o pone otra distinta). */
export async function aceptarCategoriaIa(
  facturaId: string,
  categoriaId?: string | null,
): Promise<void> {
  await pedir({ facturaId, accion: "aceptar_categoria", categoria_id: categoriaId ?? null })
}
