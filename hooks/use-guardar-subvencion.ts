"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { subvencionesKey } from "@/hooks/use-subvenciones"
import { actualizarSubvencion } from "@/lib/services/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import type { SubvencionConResumen, SubvencionUpdate } from "@/lib/types/database"

export interface OpcionesGuardado {
  /**
   * Si viene, se enseña un aviso con "Deshacer" (design.md §3.6: ya
   * reversible → aviso deshacible). Para lo que se cambia rápido y duele si
   * se escribe mal: el estado, los importes, el financiador.
   */
  aviso?: string
  /** Campos que no son columnas pero se pintan (p. ej. el financiador embebido). */
  optimista?: Partial<SubvencionConResumen>
}

/**
 * Guarda uno o varios campos de una subvención desde la edición inline.
 *
 * La pantalla cambia antes de que conteste el servidor —en la lista y en la
 * ficha a la vez, que son dos consultas distintas—, y si falla vuelve a lo que
 * había y enseña el error de verdad (`describirError`). No se invalida nada:
 * el servidor devuelve la fila y con eso basta; recargar la lista entera en
 * cada campo haría parpadear la pantalla mientras se anota.
 */
export function useGuardarSubvencion() {
  const qc = useQueryClient()

  const aplicar = useCallback(
    (id: string, patch: Partial<SubvencionConResumen>) => {
      qc.setQueryData<SubvencionConResumen[]>(subvencionesKey, (lista) =>
        lista?.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      )
      qc.setQueryData<SubvencionConResumen | null>([...subvencionesKey, id, "ficha"], (f) =>
        f ? { ...f, ...patch } : f,
      )
    },
    [qc],
  )

  const guardar = useCallback(
    async (s: SubvencionConResumen, cambios: SubvencionUpdate, opciones: OpcionesGuardado = {}) => {
      const antes: Partial<SubvencionConResumen> = {}
      for (const k of Object.keys(cambios) as (keyof SubvencionUpdate)[]) {
        ;(antes as any)[k] = (s as any)[k]
      }
      if (opciones.optimista) {
        for (const k of Object.keys(opciones.optimista) as (keyof SubvencionConResumen)[]) {
          ;(antes as any)[k] = (s as any)[k]
        }
      }

      aplicar(s.id, { ...(cambios as Partial<SubvencionConResumen>), ...opciones.optimista })
      try {
        const guardada = await actualizarSubvencion(s.id, cambios)
        aplicar(s.id, { actualizado_en: guardada.actualizado_en })
      } catch (err) {
        aplicar(s.id, antes)
        toast.error(describirError(err, "No se ha podido guardar el cambio"))
        throw err
      }

      if (opciones.aviso) {
        const deshacer = { ...antes } as SubvencionUpdate & Partial<SubvencionConResumen>
        delete (deshacer as any).financiador
        delete (deshacer as any).resumen
        toast.success(opciones.aviso, {
          duration: 7000,
          action: {
            label: "Deshacer",
            onClick: () => {
              aplicar(s.id, antes)
              actualizarSubvencion(s.id, deshacer).catch((err) => {
                toast.error(describirError(err, "No se ha podido deshacer"))
                qc.invalidateQueries({ queryKey: subvencionesKey })
              })
            },
          },
        })
      }
    },
    [aplicar, qc],
  )

  return guardar
}
