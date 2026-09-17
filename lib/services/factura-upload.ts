"use client"

import { DatabaseService } from "@/lib/services/database"
import { FileService } from "@/lib/services/file-service"
import type { Factura, FacturaOrigen } from "@/lib/types/database"

/** Limpia el nombre de archivo para usarlo como concepto provisional. */
export function conceptoDesdeNombre(nombre: string): string {
  return nombre
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120)
}

export interface CrearFacturaDesdeArchivoParams {
  file: File
  delegacionId: string
  delegacionCodigo: string
  usuarioId: string
  origen?: FacturaOrigen
  /** Pago MCM al que pertenece el ticket, si el reembolso ya existe. */
  pagoMcmId?: string | null
}

/**
 * Un archivo → una factura en la bandeja con su documento ya subido.
 *
 * Vive fuera de los hooks porque hay dos puertas al mismo sitio (la bandeja de
 * Facturas y los tickets de un pago MCM) y las dos tienen que dejar la factura
 * exactamente igual: si el documento no llega a Storage, la factura no se queda
 * vacía colgando en la bandeja.
 */
export async function crearFacturaDesdeArchivo({
  file,
  delegacionId,
  delegacionCodigo,
  usuarioId,
  origen = "subida",
  pagoMcmId = null,
}: CrearFacturaDesdeArchivoParams): Promise<Factura> {
  const validation = FileService.validateFile(file, "facturas")
  if (!validation.valid) {
    throw new Error(`${file.name}: ${validation.error}`)
  }

  const factura = await DatabaseService.createFactura({
    delegacion_id: delegacionId,
    concepto: conceptoDesdeNombre(file.name) || null,
    estado: "bandeja",
    origen,
    pago_mcm_id: pagoMcmId,
    creado_por: usuarioId,
  })

  try {
    const upload = await FileService.uploadFileForEntity(
      file,
      { scope: "factura", id: factura.id },
      "facturas",
      delegacionCodigo,
    )
    await DatabaseService.registrarArchivoFactura(factura.id, delegacionId, {
      nombre_original: file.name,
      nombre_archivo: upload.path.split("/").pop() || file.name,
      tipo_mime: file.type,
      tamanoBytes: file.size,
      bucket: upload.bucket,
      path_storage: upload.path,
      url_publica: upload.url,
      subido_por: usuarioId,
    })
  } catch (err) {
    await DatabaseService.deleteFactura(factura.id).catch(() => undefined)
    throw err
  }

  return factura
}
