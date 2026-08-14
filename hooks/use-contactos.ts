"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DatabaseService } from "@/lib/services/database"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import type {
  Contacto,
  ContactoConCategoriaPredeterminada,
  ContactoInsert,
  ContactoTipo,
  ContactoUpdate,
} from "@/lib/types/database"
import { archivadoEfectivoContacto } from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 12000

export interface UseContactosOptions {
  tipo?: ContactoTipo
  busqueda?: string
  incluirArchivados?: boolean
  incluirGlobales?: boolean
  /** Añade los proveedores globales que esta delegación aún no usa. */
  incluirCatalogo?: boolean
}

export function useContactos(delegacionId?: string | null, options: UseContactosOptions = {}) {
  const [contactos, setContactos] = useState<ContactoConCategoriaPredeterminada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const contactosRef = useRef(contactos)
  contactosRef.current = contactos

  const incluirGlobales = options.incluirGlobales ?? true
  const incluirArchivados = options.incluirArchivados ?? false
  const incluirCatalogo = options.incluirCatalogo ?? false
  const tipo = options.tipo
  const busqueda = options.busqueda?.trim() || undefined

  const fetchContactos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)

    try {
      if (!delegacionId && !incluirGlobales) {
        setContactos([])
        setLoading(false)
        return
      }

      if (contactosRef.current.length === 0) {
        setLoading(true)
      }

      const data = await Promise.race([
        DatabaseService.getContactosByDelegacion(delegacionId, {
          tipo,
          busqueda,
          incluirArchivados,
          incluirGlobales,
          incluirCatalogo,
          signal: ac.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`contactos timeout after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return
      setContactos(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      unregisterAC(ac)
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, tipo, busqueda, incluirArchivados, incluirGlobales, incluirCatalogo])

  const fetchRef = useRef(fetchContactos)
  fetchRef.current = fetchContactos

  useEffect(() => {
    fetchRef.current()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
    }
     
  }, [delegacionId, tipo, busqueda, incluirArchivados, incluirGlobales, incluirCatalogo])

  useRevalidateOnFocusJitter(() => fetchRef.current(), { minMs: 80, maxMs: 200 })

  const createContacto = useCallback(
    async (payload: Omit<ContactoInsert, "creado_en" | "actualizado_en">) => {
      const created = await DatabaseService.createContacto(payload)
      await fetchRef.current()
      return created
    },
    [],
  )

  const updateContacto = useCallback(async (id: string, updates: ContactoUpdate) => {
    await DatabaseService.updateContacto(id, updates)
    setContactos((prev) =>
      prev.map((c) => (c.id === id ? ({ ...c, ...updates } as ContactoConCategoriaPredeterminada) : c)),
    )
  }, [])

  const deleteContacto = useCallback(async (id: string) => {
    await DatabaseService.deleteContacto(id)
    setContactos((prev) => prev.filter((c) => c.id !== id))
  }, [])

  /**
   * Archivar un contacto global es cosa de cada delegación: se guarda en su
   * adopción, así que dejar de ver Mercadona aquí no se lo quita a nadie.
   */
  const archiveContacto = useCallback(
    async (id: string, archivado: boolean) => {
      const contacto = contactosRef.current.find((c) => c.id === id)
      await DatabaseService.archiveContacto(id, archivado, {
        esGlobal: Boolean(contacto?.es_global),
        delegacionId,
      })
      setContactos((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          if (c.es_global && delegacionId) {
            return {
              ...c,
              adopcion: {
                delegacion_id: delegacionId,
                categoria_id_predeterminada: c.adopcion?.categoria_id_predeterminada ?? null,
                alias: c.adopcion?.alias ?? null,
                notas: c.adopcion?.notas ?? null,
                archivado,
              },
            }
          }
          return { ...c, archivado }
        }),
      )
    },
    [delegacionId],
  )

  /** Empieza a usar en esta delegación un proveedor que ya existe en el catálogo. */
  const adoptarContacto = useCallback(
    async (id: string) => {
      if (!delegacionId) throw new Error("Selecciona una delegación antes de adoptar un contacto")
      await DatabaseService.adoptarContacto(id, delegacionId)
      await fetchRef.current()
    },
    [delegacionId],
  )

  const counts = useMemo(() => {
    const base = { proveedor: 0, persona_mcm: 0, destinatario_mcm: 0, total: 0 }
    for (const c of contactos) {
      // El catálogo no se cuenta: son proveedores que esta delegación no usa.
      if (c.en_catalogo || archivadoEfectivoContacto(c)) continue
      base[c.tipo] += 1
      base.total += 1
    }
    return base
  }, [contactos])

  return {
    contactos,
    loading,
    error,
    counts,
    refetch: fetchContactos,
    createContacto,
    updateContacto,
    deleteContacto,
    archiveContacto,
    adoptarContacto,
  }
}

export type UseContactosReturn = ReturnType<typeof useContactos>

// Hook ligero para el detalle de un contacto (información + movimientos vinculados)
export function useContactoDetalle(contactoId: string | null) {
  const [contacto, setContacto] = useState<ContactoConCategoriaPredeterminada | null>(null)
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof DatabaseService.getMovimientosByContacto>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetalle = useCallback(async () => {
    if (!contactoId) {
      setContacto(null)
      setMovimientos([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [c, m] = await Promise.all([
        DatabaseService.getContactoById(contactoId),
        DatabaseService.getMovimientosByContacto(contactoId, { limite: 200 }),
      ])
      setContacto(c)
      setMovimientos(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el contacto")
    } finally {
      setLoading(false)
    }
  }, [contactoId])

  useEffect(() => {
    fetchDetalle()
  }, [fetchDetalle])

  const totales = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const m of movimientos) {
      if (m.importe >= 0) ingresos += m.importe
      else gastos += m.importe
    }
    return { ingresos, gastos, neto: ingresos + gastos, total: movimientos.length }
  }, [movimientos])

  return { contacto, movimientos, totales, loading, error, refetch: fetchDetalle }
}

export type UseContactoDetalleReturn = ReturnType<typeof useContactoDetalle>
export type { Contacto, ContactoConCategoriaPredeterminada }
