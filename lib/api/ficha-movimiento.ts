import type { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "@/lib/api/errors"
import { obtenerFactura, type FacturaPublica } from "@/lib/api/facturas"
import { urlFirmada } from "@/lib/api/archivos"
import { obtenerMovimiento, type ArchivoPublico, type MovimientoPublico } from "@/lib/api/movimientos-public"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Ficha de un movimiento: todo lo que hace falta para copiarlo a otro sitio
 * (una hoja de cálculo, un Drive) en **una sola llamada** —movimiento, factura
 * vinculada, importes y los ficheros con una URL firmada lista para descargar.
 *
 * Existe porque el consumidor típico es un Apps Script que recorre filas de una
 * hoja, y encadenar `/movimientos/{id}` → `/facturas/{id}` → `/archivos/{id}/url`
 * son tres o más viajes por fila, con el límite de tiempo de Apps Script encima.
 */

export interface ArchivoFicha extends ArchivoPublico {
  /** Dónde está registrado: en el movimiento, en la factura o en los dos. */
  registrado_en: ("movimiento" | "factura")[]
  /**
   * Descargable sin clave de API hasta que caduque. Ver `caduca_en_segundos`.
   * `null` si el registro existe pero el fichero ya no está en Storage (mira
   * `error_url`): un fichero roto no tiene que tumbar la ficha entera.
   */
  url_firmada: string | null
  caduca_en_segundos: number
  error_url?: string
}

export interface ImportesFicha {
  moneda: string
  /** Con signo, tal y como está en el banco (los gastos son negativos). */
  movimiento: number
  /** Valor absoluto del movimiento: lo que salió (o entró) de la cuenta. */
  movimiento_abs: number
  /** Lo que dice la factura (siempre en positivo). `null` si no tiene importe. */
  factura: number | null
  /** Suma de todos los movimientos vinculados a la factura, en valor absoluto. */
  factura_pagado: number | null
  factura_pendiente: number | null
  /** `factura - movimiento_abs`. `null` si no hay factura o no tiene importe. */
  diferencia: number | null
}

export interface FichaMovimiento {
  movimiento: Omit<MovimientoPublico, "archivos">
  factura: FacturaPublica | null
  importes: ImportesFicha
  archivos: ArchivoFicha[]
}

export const SEGUNDOS_URL_MIN = 60
export const SEGUNDOS_URL_MAX = 3600
export const SEGUNDOS_URL_DEFECTO = 900

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

/** Calcula el bloque de importes a partir del movimiento y su factura. */
export function calcularImportes(
  movimiento: Pick<MovimientoPublico, "importe">,
  factura: Pick<FacturaPublica, "importe" | "moneda" | "importe_pagado" | "importe_pendiente"> | null,
): ImportesFicha {
  const importe = Number(movimiento.importe)
  const abs = redondear(Math.abs(importe))
  const importeFactura = factura?.importe ?? null
  return {
    moneda: factura?.moneda ?? "EUR",
    movimiento: importe,
    movimiento_abs: abs,
    factura: importeFactura,
    factura_pagado: factura ? factura.importe_pagado : null,
    factura_pendiente: factura ? factura.importe_pendiente : null,
    diferencia: importeFactura == null ? null : redondear(importeFactura - abs),
  }
}

/**
 * Une los archivos del movimiento y los de su factura. Una factura subida desde
 * un movimiento se replica en las dos tablas con el mismo `path_storage`, así
 * que se cuenta una sola vez.
 */
export function unirArchivos(
  delMovimiento: ArchivoPublico[],
  delaFactura: ArchivoPublico[],
): { archivo: ArchivoPublico; registrado_en: ("movimiento" | "factura")[] }[] {
  const porRuta = new Map<string, { archivo: ArchivoPublico; registrado_en: ("movimiento" | "factura")[] }>()
  const anotar = (archivo: ArchivoPublico, donde: "movimiento" | "factura") => {
    const clave = `${archivo.bucket}/${archivo.path_storage ?? archivo.id}`
    const existente = porRuta.get(clave)
    if (existente) existente.registrado_en.push(donde)
    else porRuta.set(clave, { archivo, registrado_en: [donde] })
  }
  delMovimiento.forEach((a) => anotar(a, "movimiento"))
  delaFactura.forEach((a) => anotar(a, "factura"))
  return [...porRuta.values()]
}

export async function obtenerFichaMovimiento(
  admin: AdminClient,
  id: string,
  options: { baseUrl?: string; segundosUrl?: number } = {},
): Promise<FichaMovimiento> {
  const movimiento = await obtenerMovimiento(admin, id, { baseUrl: options.baseUrl })
  if (!movimiento) throw notFound(`No existe ningún movimiento con el id ${id}.`)

  const factura = movimiento.factura_id
    ? await obtenerFactura(admin, movimiento.factura_id, { baseUrl: options.baseUrl })
    : null

  const segundos = Math.min(
    Math.max(options.segundosUrl ?? SEGUNDOS_URL_DEFECTO, SEGUNDOS_URL_MIN),
    SEGUNDOS_URL_MAX,
  )
  const unidos = unirArchivos(movimiento.archivos, factura?.archivos ?? [])
  const archivos = await Promise.all(
    unidos.map(async ({ archivo, registrado_en }): Promise<ArchivoFicha> => {
      try {
        return {
          ...archivo,
          registrado_en,
          url_firmada: await urlFirmada(admin, archivo.bucket, archivo.path_storage ?? "", segundos),
          caduca_en_segundos: segundos,
        }
      } catch (err) {
        // Un registro sin fichero detrás se señala, no se propaga: antes un solo
        // huérfano devolvía 502 y la ficha del movimiento no se podía leer.
        return {
          ...archivo,
          registrado_en,
          url_firmada: null,
          caduca_en_segundos: segundos,
          error_url: err instanceof Error ? err.message : "No se pudo generar la URL de descarga.",
        }
      }
    }),
  )

  const { archivos: _archivos, ...sinArchivos } = movimiento
  return {
    movimiento: sinArchivos,
    // Los archivos de la factura ya viajan en `archivos`, con su URL firmada.
    factura: factura ? { ...factura, archivos: [] } : null,
    importes: calcularImportes(movimiento, factura),
    archivos,
  }
}
