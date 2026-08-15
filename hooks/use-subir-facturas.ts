"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { FileService } from "@/lib/services/file-service"
import { leerFacturaConIa } from "@/lib/services/factura-ia-client"

/** Limpia el nombre de archivo para usarlo como concepto provisional. */
function conceptoDesdeNombre(nombre: string): string {
  return nombre
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120)
}

export interface EstadoSubidaFacturas {
  uploading: boolean
  leyendo: boolean
  progreso: { done: number; total: number } | null
  ocupado: boolean
}

/**
 * Subir archivos a la bandeja: una factura por archivo, y lectura con IA del
 * lote entero al terminar.
 *
 * Vive en un hook y no dentro de la zona de arrastre porque ahora hay dos
 * puertas al mismo sitio —el recuadro de la página y el arrastre a pantalla
 * completa (`factura-drop-overlay.tsx`)— y las dos tienen que subir igual y
 * compartir el mismo indicador de progreso.
 */
export function useSubirFacturas(delegacionId: string | null, onCreated: () => void | Promise<void>) {
  const { user } = useAuth()
  const { getCurrentDelegation } = useDelegationContext()
  const delegacionCodigo = getCurrentDelegation()?.codigo ?? undefined

  const [uploading, setUploading] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [progreso, setProgreso] = useState<{ done: number; total: number } | null>(null)

  const subir = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return
      if (!delegacionId || !delegacionCodigo || !user) {
        toast.error("Selecciona una delegación antes de subir facturas")
        return
      }

      setUploading(true)
      setProgreso({ done: 0, total: accepted.length })
      let creadas = 0
      const nuevas: string[] = []
      try {
        for (const file of accepted) {
          const validation = FileService.validateFile(file, "facturas")
          if (!validation.valid) {
            toast.error(`${file.name}: ${validation.error}`)
            continue
          }

          const factura = await DatabaseService.createFactura({
            delegacion_id: delegacionId,
            concepto: conceptoDesdeNombre(file.name) || null,
            estado: "bandeja",
            origen: "subida",
            creado_por: user.id,
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
              subido_por: user.id,
            })
          } catch (err) {
            // Si falla la subida del archivo, no dejamos la factura vacía colgando.
            await DatabaseService.deleteFactura(factura.id).catch(() => undefined)
            throw err
          }

          creadas += 1
          nuevas.push(factura.id)
          setProgreso({ done: creadas, total: accepted.length })
        }

        if (creadas > 0) {
          toast.success(
            creadas === 1 ? "Factura añadida a la bandeja" : `${creadas} facturas añadidas a la bandeja`,
          )
          await onCreated()

          // Lectura con IA de todo el lote a la vez. Se espera a que termine para
          // que la bandeja aparezca ya con los datos puestos, pero un fallo aquí
          // no invalida la subida: las facturas ya están guardadas.
          setLeyendo(true)
          try {
            await Promise.allSettled(nuevas.map((id) => leerFacturaConIa(id)))
          } finally {
            setLeyendo(false)
            await onCreated()
          }
        }
      } catch (err) {
        toast.error("No se pudo subir: " + (err instanceof Error ? err.message : "error desconocido"))
      } finally {
        setUploading(false)
        setProgreso(null)
      }
    },
    [delegacionId, delegacionCodigo, user, onCreated],
  )

  return {
    subir,
    uploading,
    leyendo,
    progreso,
    ocupado: uploading || leyendo,
    listo: Boolean(delegacionId && delegacionCodigo && user),
  }
}
