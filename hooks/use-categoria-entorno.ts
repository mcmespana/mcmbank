"use client"

import { useEffect, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import type { Categoria } from "@/lib/types/database"

export interface CategoriaEntorno {
  categoria: Categoria
  /** Movimientos de esa categoría alrededor de la fecha. */
  movimientos: number
  /** Movimientos categorizados en total en esa ventana. */
  total: number
  ratio: number
}

/**
 * La actividad que domina los movimientos de alrededor de una fecha.
 *
 * En una delegación el dinero se mueve por temporadas: todo lo que entra y
 * sale en junio suele ser del campamento de julio. Así que cuando la mayoría
 * de los apuntes de esas semanas van a una misma categoría, lo que llega con
 * esa fecha casi siempre va ahí también — una señal más fiable que mirar solo
 * el documento, que es lo que hace la IA.
 *
 * Devuelve null si no hay mayoría clara: preferimos no sugerir nada a sugerir
 * flojo, porque una sugerencia se acepta sin mirar.
 */
export function useCategoriaEntorno(
  delegacionId: string | null | undefined,
  fecha: string | null | undefined,
  categorias: Categoria[],
): { sugerencia: CategoriaEntorno | null; loading: boolean } {
  // El resultado se guarda junto a la clave que lo pidió: así, al cambiar la
  // fecha, el render descarta el anterior por sí solo y no hace falta limpiarlo
  // con un setState al entrar en el efecto (que además provoca un render de más).
  const [resultado, setResultado] = useState<{
    clave: string
    valor: { categoriaId: string; movimientos: number; total: number; ratio: number } | null
  } | null>(null)

  const clave = delegacionId && fecha ? `${delegacionId}|${fecha}` : null

  useEffect(() => {
    if (!clave || !delegacionId || !fecha) return
    let cancelado = false
    DatabaseService.getCategoriaDominanteCerca(delegacionId, fecha)
      .then((valor) => {
        if (!cancelado) setResultado({ clave, valor })
      })
      .catch(() => {
        if (!cancelado) setResultado({ clave, valor: null })
      })
    return () => {
      cancelado = true
    }
  }, [clave, delegacionId, fecha])

  const bruto = resultado?.clave === clave ? resultado.valor : null
  const categoria = bruto ? categorias.find((c) => c.id === bruto.categoriaId) : undefined
  // Si la categoría dominante no está entre las que puede elegir esta
  // delegación (inactiva, o de otra), la sugerencia no se puede aplicar.
  const sugerencia =
    bruto && categoria
      ? { categoria, movimientos: bruto.movimientos, total: bruto.total, ratio: bruto.ratio }
      : null

  // "Cargando" es simplemente que todavía no hay respuesta para esta clave.
  return { sugerencia, loading: Boolean(clave) && resultado?.clave !== clave }
}
