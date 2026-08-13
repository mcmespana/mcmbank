"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AvisosService } from "@/lib/services/avisos"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import type {
  Aviso,
  AvisoAsignable,
  AvisoCambios,
  AvisoContadores,
  AvisoDestinatario,
  NuevoAviso,
} from "@/lib/types/avisos"

const QUERY_TIMEOUT_MS = 12_000
// Sondeo suave: el panel se revalida al enfocar la pestaña; este intervalo solo
// cubre el caso de tenerla abierta y quieta un buen rato.
const POLL_MS = 120_000

const ROLES_ESCRITURA = ["tesorero", "gestor_central"]

export interface UseAvisosResult {
  avisos: Aviso[]
  hechos: Aviso[]
  loading: boolean
  loadingHechos: boolean
  error: string | null
  contadores: AvisoContadores
  /** Lado del usuario en esta delegación (oficina técnica o delegación). */
  miLado: AvisoDestinatario
  /** false mientras no se sabe el rol: `miLado` todavía no es fiable. */
  rolConocido: boolean
  puedeEscribir: boolean
  refetch: () => Promise<void>
  cargarHechos: () => Promise<void>
  crear: (payload: NuevoAviso) => Promise<Aviso>
  completar: (id: string) => Promise<void>
  reabrir: (id: string) => Promise<void>
  eliminar: (id: string) => Promise<void>
  marcarLeidos: (ids: string[]) => Promise<void>
  notificar: (id: string) => Promise<string[]>
  /** Responsable, fecha límite y/o prioridad de una tarea ya creada. */
  actualizarCambios: (id: string, cambios: AvisoCambios) => Promise<void>
  /** A quién se le puede asignar una tarea dirigida a `destinatario`. */
  listarAsignables: (destinatario: AvisoDestinatario) => Promise<AvisoAsignable[]>
}

export function useAvisos(delegacionId?: string | null): UseAvisosResult {
  const { user } = useAuth()
  const { role, loading: roleLoading } = useDelegationRole(delegacionId)

  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [hechos, setHechos] = useState<Aviso[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHechos, setLoadingHechos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const avisosRef = useRef(avisos)
  avisosRef.current = avisos

  const usuarioId = user?.id ?? null
  const miLado: AvisoDestinatario = role === "gestor_central" ? "oficina_tecnica" : "delegacion"
  const puedeEscribir = role ? ROLES_ESCRITURA.includes(role) : false
  // Esperamos a conocer el rol: define qué avisos son "para mí".
  const listo = Boolean(delegacionId && usuarioId && !roleLoading && role)

  const fetchAvisos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
      abortRef.current = null
    }

    if (!listo || !delegacionId || !usuarioId) {
      if (!delegacionId) setAvisos([])
      if (!roleLoading) setLoading(false)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)

    try {
      if (avisosRef.current.length === 0) setLoading(true)

      const data = await Promise.race([
        AvisosService.listar(delegacionId, { usuarioId, miLado }, { signal: ac.signal }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("avisos timeout")), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return
      setAvisos(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "Error cargando los avisos")
    } finally {
      unregisterAC(ac)
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, usuarioId, miLado, listo, roleLoading])

  const fetchRef = useRef(fetchAvisos)
  fetchRef.current = fetchAvisos

  useEffect(() => {
    fetchRef.current()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
        abortRef.current = null
      }
    }
  }, [delegacionId, usuarioId, miLado, listo])

  useRevalidateOnFocusJitter(() => fetchRef.current(), { minMs: 80, maxMs: 220 })

  useEffect(() => {
    if (!listo) return
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      fetchRef.current()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [listo])

  const cargarHechos = useCallback(async () => {
    if (!delegacionId || !usuarioId) return
    setLoadingHechos(true)
    try {
      const data = await AvisosService.listar(
        delegacionId,
        { usuarioId, miLado },
        { incluirHechos: true, limite: 60 },
      )
      setHechos(data.filter((a) => a.estado === "hecha"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando el historial")
    } finally {
      setLoadingHechos(false)
    }
  }, [delegacionId, usuarioId, miLado])

  const crear = useCallback(
    async (payload: NuevoAviso) => {
      if (!delegacionId || !usuarioId) throw new Error("Falta la delegación o el usuario")
      const creado = await AvisosService.crear(delegacionId, usuarioId, payload)
      setAvisos((prev) => [creado, ...prev])
      if (payload.notificar) {
        try {
          await AvisosService.notificar(creado.id)
          setAvisos((prev) =>
            prev.map((a) => (a.id === creado.id ? { ...a, notificado_en: new Date().toISOString() } : a)),
          )
        } catch (err) {
          // El aviso ya está guardado; el correo es un extra.
          throw new Error(
            err instanceof Error
              ? `Guardado, pero el correo no salió: ${err.message}`
              : "Guardado, pero el correo no salió",
          )
        }
      }
      return creado
    },
    [delegacionId, usuarioId],
  )

  const completar = useCallback(
    async (id: string) => {
      const previo = avisosRef.current
      setAvisos((prev) => prev.filter((a) => a.id !== id))
      try {
        await AvisosService.cambiarEstado(id, "hecha", usuarioId ?? undefined)
      } catch (err) {
        setAvisos(previo)
        throw err
      }
    },
    [usuarioId],
  )

  const reabrir = useCallback(async (id: string) => {
    setHechos((prev) => prev.filter((a) => a.id !== id))
    await AvisosService.cambiarEstado(id, "pendiente")
    await fetchRef.current()
  }, [])

  const eliminar = useCallback(async (id: string) => {
    const previo = avisosRef.current
    setAvisos((prev) => prev.filter((a) => a.id !== id))
    setHechos((prev) => prev.filter((a) => a.id !== id))
    try {
      await AvisosService.eliminar(id)
    } catch (err) {
      setAvisos(previo)
      throw err
    }
  }, [])

  const marcarLeidos = useCallback(
    async (ids: string[]) => {
      if (!usuarioId || ids.length === 0) return
      const pendientesDeMarcar = ids.filter((id) =>
        avisosRef.current.some((a) => a.id === id && a.noLeido),
      )
      if (pendientesDeMarcar.length === 0) return

      setAvisos((prev) =>
        prev.map((a) => (pendientesDeMarcar.includes(a.id) ? { ...a, noLeido: false } : a)),
      )
      try {
        await AvisosService.marcarLeidos(pendientesDeMarcar, usuarioId)
      } catch (err) {
        console.error("No se pudieron marcar los avisos como leídos", err)
        await fetchRef.current()
      }
    },
    [usuarioId],
  )

  const notificar = useCallback(async (id: string) => {
    const { destinatarios } = await AvisosService.notificar(id)
    const ahora = new Date().toISOString()
    setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, notificado_en: ahora } : a)))
    return destinatarios
  }, [])

  const actualizarCambios = useCallback(async (id: string, cambios: AvisoCambios) => {
    const previo = avisosRef.current
    setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)))
    try {
      await AvisosService.actualizarCambios(id, cambios)
      await fetchRef.current()
    } catch (err) {
      setAvisos(previo)
      throw err
    }
  }, [])

  const listarAsignables = useCallback(
    (destinatario: AvisoDestinatario) => {
      if (!delegacionId) return Promise.resolve([])
      return AvisosService.listarAsignables(delegacionId, destinatario)
    },
    [delegacionId],
  )

  const contadores = useMemo<AvisoContadores>(
    () => ({
      noLeidos: avisos.filter((a) => a.noLeido).length,
      pendientes: avisos.filter((a) => a.tipo === "tarea" && a.esParaMi && a.estado === "pendiente").length,
    }),
    [avisos],
  )

  return {
    avisos,
    hechos,
    loading: loading || roleLoading,
    loadingHechos,
    error,
    contadores,
    miLado,
    rolConocido: Boolean(role),
    puedeEscribir,
    refetch: useCallback(() => fetchRef.current(), []),
    cargarHechos,
    crear,
    completar,
    reabrir,
    eliminar,
    marcarLeidos,
    notificar,
    actualizarCambios,
    listarAsignables,
  }
}

export default useAvisos
