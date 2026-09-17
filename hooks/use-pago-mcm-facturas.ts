"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { FileService } from "@/lib/services/file-service"
import { crearFacturaDesdeArchivo } from "@/lib/services/factura-upload"
import { leerFacturaConIa } from "@/lib/services/factura-ia-client"
import type { FacturaConRelaciones } from "@/lib/types/database"

/**
 * Los tickets de un pago MCM, que son facturas de verdad.
 *
 * Aniceto adelanta un ticket del Consum: el documento es una factura del
 * proveedor y vive en la bandeja como cualquier otra —se lee con IA, se
 * concilia, cuenta para el saldo de Consum—; lo que el pago MCM añade es a
 * quién se le debe ese dinero.
 *
 * El pago todavía no existe cuando se está creando, así que las facturas nacen
 * sin `pago_mcm_id` y `asignarAPago()` las engancha al guardar. Si se cancela a
 * medias, el documento se queda en la bandeja en lugar de perderse: es lo menos
 * malo, porque el papel ya está subido y alguien tendrá que ocuparse de él.
 */
export function usePagoMcmFacturas(pagoId: string | null, delegacionId: string | null) {
  const { user } = useAuth()
  const { getCurrentDelegation } = useDelegationContext()
  const delegacionCodigo = getCurrentDelegation()?.codigo ?? undefined

  const [facturas, setFacturas] = useState<FacturaConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [progreso, setProgreso] = useState<{ done: number; total: number } | null>(null)
  // Las creadas en esta sesión del formulario, para poder engancharlas al pago
  // en cuanto exista (y para recargarlas cuando aún no hay pago al que pedirlas).
  const creadasAquiRef = useRef<string[]>([])

  const recargar = useCallback(async () => {
    if (pagoId) {
      const data = await DatabaseService.getFacturasDePago(pagoId)
      setFacturas(data)
      return
    }
    const ids = creadasAquiRef.current
    if (ids.length === 0) {
      setFacturas([])
      return
    }
    const data = await Promise.all(ids.map((id) => DatabaseService.getFacturaById(id)))
    setFacturas(data.filter((f): f is FacturaConRelaciones => f !== null))
  }, [pagoId])

  useEffect(() => {
    let cancelado = false
    if (!pagoId) return
    setLoading(true)
    DatabaseService.getFacturasDePago(pagoId)
      .then((data) => {
        if (!cancelado) setFacturas(data)
      })
      .catch((err) => console.warn("No se pudieron cargar los tickets del pago:", err))
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [pagoId])

  const subir = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return
      if (!delegacionId || !delegacionCodigo || !user) {
        toast.error("Selecciona una delegación antes de subir tickets")
        return
      }

      setUploading(true)
      setProgreso({ done: 0, total: accepted.length })
      const nuevas: string[] = []
      try {
        for (const file of accepted) {
          const validation = FileService.validateFile(file, "facturas")
          if (!validation.valid) {
            toast.error(`${file.name}: ${validation.error}`)
            continue
          }

          const factura = await crearFacturaDesdeArchivo({
            file,
            delegacionId,
            delegacionCodigo,
            usuarioId: user.id,
            origen: "pago_mcm",
            pagoMcmId: pagoId,
          })
          nuevas.push(factura.id)
          creadasAquiRef.current = [...creadasAquiRef.current, factura.id]
          setProgreso({ done: nuevas.length, total: accepted.length })
        }

        if (nuevas.length === 0) return

        await recargar()

        // La IA rellena el proveedor y el importe del ticket. Que falle no
        // invalida nada: el documento ya está guardado y se puede completar a mano.
        setLeyendo(true)
        try {
          await Promise.allSettled(nuevas.map((id) => leerFacturaConIa(id)))
        } finally {
          setLeyendo(false)
          await recargar()
        }
      } catch (err) {
        toast.error("No se pudo subir: " + (err instanceof Error ? err.message : "error desconocido"))
      } finally {
        setUploading(false)
        setProgreso(null)
      }
    },
    [delegacionId, delegacionCodigo, user, pagoId, recargar],
  )

  const eliminar = useCallback(async (facturaId: string) => {
    await DatabaseService.deleteFactura(facturaId)
    creadasAquiRef.current = creadasAquiRef.current.filter((id) => id !== facturaId)
    setFacturas((prev) => prev.filter((f) => f.id !== facturaId))
  }, [])

  /** Engancha al pago recién guardado los tickets que se subieron antes de existir. */
  const asignarAPago = useCallback(async (nuevoPagoId: string) => {
    const pendientes = creadasAquiRef.current
    if (pendientes.length === 0) return
    await Promise.all(
      pendientes.map((id) =>
        DatabaseService.updateFactura(id, { pago_mcm_id: nuevoPagoId }).catch((err) =>
          console.warn("No se pudo enganchar el ticket al pago:", err),
        ),
      ),
    )
    creadasAquiRef.current = []
  }, [])

  const total = facturas.reduce((suma, f) => suma + (f.importe != null ? Math.abs(Number(f.importe)) : 0), 0)

  return {
    facturas,
    total,
    loading,
    uploading,
    leyendo,
    progreso,
    ocupado: uploading || leyendo,
    listo: Boolean(delegacionId && delegacionCodigo && user),
    subir,
    eliminar,
    asignarAPago,
    recargar,
  }
}
