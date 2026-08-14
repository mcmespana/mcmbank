/**
 * Lectura automática de facturas: forma de lo que se guarda en
 * `factura.datos_ia`.
 *
 * Es un sobre versionado a propósito. La columna es JSONB y la va a leer tanto
 * el servidor (que la escribe) como la UI (que enseña las sugerencias), así que
 * el contrato tiene que estar en un sitio que puedan importar los dos, sin
 * `"use client"` ni dependencias de Supabase.
 *
 * Regla que atraviesa todo el módulo: **la IA sugiere, no decide**. Lo único
 * que se escribe directamente en la factura son los campos de transcripción y
 * solo cuando están vacíos (ver `campos_rellenados`); la categoría vive aquí
 * hasta que una persona la acepta.
 */

export const FACTURA_IA_VERSION = 1

export type FacturaIaEstado =
  /** La extracción está en marcha (la UI enseña "leyendo…"). */
  | "procesando"
  /** Terminó bien: hay sugerencias. */
  | "listo"
  /** No había ningún documento legible que mandar al modelo. */
  | "sin_documento"
  /** Falló (sin API key, error del modelo, respuesta no válida…). */
  | "error"

export interface FacturaIaProveedor {
  nombre: string | null
  identificador_fiscal: string | null
  email: string | null
  /** Contacto de MCM Bank con el que se ha casado (o el que se ha creado). */
  contacto_id: string | null
  /** `true` si el contacto no existía y se ha dado de alta en este proceso. */
  creado: boolean
}

export interface FacturaIaCategoria {
  id: string | null
  nombre: string | null
  /** Por qué la propone, en una línea. Se enseña al aceptar. */
  motivo: string | null
}

export interface FacturaIaSugerencias {
  numero: string | null
  fecha_emision: string | null
  importe: number | null
  moneda: string | null
  concepto: string | null
  proveedor: FacturaIaProveedor | null
  categoria: FacturaIaCategoria | null
}

export interface FacturaDatosIa {
  version: number
  estado: FacturaIaEstado
  modelo: string | null
  extraido_en: string | null
  /** 0-1, tal y como la declara el modelo. Orientativa. */
  confianza: number | null
  /** El modelo dice si el documento parece realmente una factura o un ticket. */
  es_factura: boolean | null
  sugerencias: FacturaIaSugerencias | null
  /** Campos de la factura que se han rellenado automáticamente por estar vacíos. */
  campos_rellenados: string[]
  /** Sello de cuándo y quién aceptó la categoría sugerida. */
  categoria_aceptada: { en: string; por: string | null } | null
  error: string | null
  uso: { tokens_entrada: number | null; tokens_salida: number | null } | null
}

/** Lee `factura.datos_ia` con cuidado: es JSONB y puede traer cualquier cosa. */
export function leerDatosIa(valor: unknown): FacturaDatosIa | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null
  const datos = valor as Partial<FacturaDatosIa>
  if (typeof datos.estado !== "string") return null
  return {
    version: typeof datos.version === "number" ? datos.version : FACTURA_IA_VERSION,
    estado: datos.estado as FacturaIaEstado,
    modelo: datos.modelo ?? null,
    extraido_en: datos.extraido_en ?? null,
    confianza: typeof datos.confianza === "number" ? datos.confianza : null,
    es_factura: typeof datos.es_factura === "boolean" ? datos.es_factura : null,
    sugerencias: (datos.sugerencias as FacturaIaSugerencias) ?? null,
    campos_rellenados: Array.isArray(datos.campos_rellenados) ? datos.campos_rellenados : [],
    categoria_aceptada: (datos.categoria_aceptada as FacturaDatosIa["categoria_aceptada"]) ?? null,
    error: datos.error ?? null,
    uso: (datos.uso as FacturaDatosIa["uso"]) ?? null,
  }
}

/** ¿Hay una categoría sugerida a la espera de que alguien la acepte? */
export function categoriaPendienteDeAceptar(datos: FacturaDatosIa | null): FacturaIaCategoria | null {
  if (!datos || datos.estado !== "listo" || datos.categoria_aceptada) return null
  const categoria = datos.sugerencias?.categoria
  return categoria?.id ? categoria : null
}
