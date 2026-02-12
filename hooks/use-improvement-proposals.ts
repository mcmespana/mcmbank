"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { runQuery } from "@/lib/db/query"
import type {
  ImprovementProposal,
  ImprovementProposalInsert,
  ImprovementProposalStatus,
  ImprovementProposalWithAuthor,
  ImprovementProposalType,
} from "@/lib/types/improvement-proposals"
import { IMPROVEMENT_PROPOSAL_STATUS_LABELS } from "@/lib/types/improvement-proposals"
import { toast } from "sonner"

interface CreateImprovementProposalInput {
  title: string
  description: string
  impact?: string | null
  type?: ImprovementProposalType
}

type ProposalQueryRow = ImprovementProposal & {
  votos?: { count: number | null }[]
  comentarios?: { count: number | null }[]
}

export function useImprovementProposals() {
  const [proposals, setProposals] = useState<ImprovementProposalWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)
  const proposalsRef = useRef<ImprovementProposalWithAuthor[]>([])

  const enrichWithAuthor = useCallback(async (rows: ImprovementProposal[]) => {
    if (rows.length === 0) return [] as ImprovementProposalWithAuthor[]

    const userIds = Array.from(
      new Set(rows.map((row) => row.creado_por).filter(Boolean)),
    ) as string[]

    let profilesMap: Record<string, string> = {}

    if (userIds.length > 0) {
      try {
        const { data: profiles, error: profilesError } = await (supabase as any)
          .from("perfil")
          .select("usuario_id, nombre_completo")
          .in("usuario_id", userIds)

        if (profilesError) {
          console.error("Error fetching profiles for proposals", profilesError)
        } else if (profiles) {
          profilesMap = (profiles as any[]).reduce((acc: Record<string, string>, perfil: any) => {
            if (perfil.nombre_completo && perfil.nombre_completo.trim()) {
              acc[perfil.usuario_id] = perfil.nombre_completo
            }
            return acc
          }, {})
        }
      } catch (profilesErr) {
        console.error("Unexpected error loading proposal profiles", profilesErr)
      }
    }

    return rows.map((row) => ({
      ...row,
      authorName:
        row.creado_por_nombre?.trim() ||
        profilesMap[row.creado_por] ||
        row.creado_por_email?.split("@")[0]?.replace(/\./g, " ")?.replace(/\b\w/g, (match) => match.toUpperCase()) ||
        "Usuario anónimo",
    }))
  }, [])

  useEffect(() => {
    proposalsRef.current = proposals
  }, [proposals])

  useEffect(() => {
    let mounted = true

    const resolveSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (mounted) {
          setCurrentUserId(session?.user?.id ?? null)
        }
      } catch (sessionError) {
        console.error("Error resolving current session for proposals", sessionError)
        if (mounted) setCurrentUserId(null)
      }
    }

    void resolveSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (mounted) {
        setCurrentUserId(session?.user?.id ?? null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProposals = useCallback(async () => {
    if (!hasFetchedRef.current) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      setError(null)
      const { data, error: fetchError } = await runQuery<ProposalQueryRow[]>({
        label: "fetch-improvement-proposals",
        table: "propuesta_mejora",
        build: async (signal) =>
          await (supabase as any)
            .from("propuesta_mejora")
            .select(
              "*, votos:propuesta_mejora_voto(count), comentarios:propuesta_mejora_comentario(count)",
            )
            .order("estado", { ascending: true })
            .order("creado_en", { ascending: false })
            .abortSignal(signal),
      })

      if (fetchError) {
        console.error("Error fetching improvement proposals", fetchError)
        setError(
          fetchError?.message ||
          "No pudimos cargar las propuestas de mejora. Intenta de nuevo más tarde.",
        )
        return
      }

      const rows = data ?? []

      let votedIds = new Set<string>()

      if (currentUserId) {
        try {
          const { data: userVotes, error: votesError } = await (supabase as any)
            .from("propuesta_mejora_voto")
            .select("propuesta_id")
            .eq("usuario_id", currentUserId)

          if (votesError) {
            console.error("Error fetching user votes for proposals", votesError)
          } else if (userVotes) {
            votedIds = new Set((userVotes as any[]).map((vote: any) => vote.propuesta_id))
          }
        } catch (votesErr) {
          console.error("Unexpected error loading user votes", votesErr)
        }
      }

      const enriched = await enrichWithAuthor(rows as ImprovementProposal[])
      const normalized = enriched.map((proposal) => {
        const raw = rows.find((row) => row.id === proposal.id)
        const votesCount = raw?.votos?.[0]?.count ?? 0
        const commentsCount = raw?.comentarios?.[0]?.count ?? 0
        return {
          ...proposal,
          votesCount,
          commentsCount,
          userHasVoted: votedIds.has(proposal.id),
        }
      })

      setProposals(normalized)
    } catch (err) {
      console.error("Unexpected error loading improvement proposals", err)
      setError(
        err instanceof Error
          ? err.message
          : "Ha ocurrido un error al cargar las propuestas.",
      )
    } finally {
      hasFetchedRef.current = true
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUserId, enrichWithAuthor])

  const createProposal = useCallback(
    async ({ title, description, impact, type = "idea" }: CreateImprovementProposalInput) => {
      const trimmedTitle = title.trim()
      const trimmedDescription = description.trim()
      const trimmedImpact = impact?.trim()

      if (!trimmedTitle) throw new Error("El título es obligatorio")
      if (!trimmedDescription)
        throw new Error(
          type === "idea" ? "Cuéntanos un poco sobre tu idea" : "Cuéntanos qué está fallando",
        )

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) throw new Error("Necesitas iniciar sesión para participar")

      let authorName = user.email?.split("@")[0] || "Usuario"

      try {
        const { data: perfil } = await (supabase as any)
          .from("perfil")
          .select("nombre_completo")
          .eq("usuario_id", user.id)
          .maybeSingle()
        if (perfil?.nombre_completo && perfil.nombre_completo.trim()) {
          authorName = perfil.nombre_completo
        } else if (user.user_metadata?.full_name) {
          authorName = user.user_metadata.full_name
        }
      } catch (profileError) {
        console.warn("No pudimos obtener el perfil del usuario", profileError)
      }

      const initialStatus = type === "idea" ? "nueva_idea" : "error_detectado"

      const payload: ImprovementProposalInsert = {
        titulo: trimmedTitle,
        descripcion: trimmedDescription,
        impacto: trimmedImpact || null,
        estado: initialStatus,
        tipo: type,
        creado_por: user.id,
        creado_por_nombre: authorName,
        creado_por_email: user.email ?? null,
      }

      const { data, error: insertError } = await (supabase as any)
        .from("propuesta_mejora")
        .insert(payload)
        .select("*")
        .single()

      if (insertError) {
        console.error("Error creating improvement proposal", insertError)
        throw insertError
      }

      const newProposal: ImprovementProposalWithAuthor = {
        ...(data as ImprovementProposal),
        authorName,
        votesCount: 0,
        commentsCount: 0,
        userHasVoted: false,
      }

      setProposals((prev) => [newProposal, ...prev])
      return newProposal
    },
    [],
  )

  const updateProposalStatus = useCallback(
    async (id: string, status: ImprovementProposalStatus) => {
      if (!id) throw new Error("Identificador de propuesta no válido")

      const { data, error: updateError } = await (supabase as any)
        .from("propuesta_mejora")
        .update({
          estado: status,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single()

      if (updateError) {
        console.error("Error updating proposal status", updateError)
        throw updateError
      }

      setProposals((prev) =>
        prev.map((proposal) =>
          proposal.id === id
            ? {
              ...(data as ImprovementProposal),
              authorName: proposal.authorName,
              votesCount: proposal.votesCount,
              commentsCount: proposal.commentsCount,
              userHasVoted: proposal.userHasVoted,
            }
            : proposal,
        ),
      )
    },
    [],
  )

  const toggleVote = useCallback(
    async (proposalId: string) => {
      if (!proposalId) return
      if (!currentUserId) {
        toast.error("Necesitas iniciar sesión para participar")
        return
      }

      const target = proposalsRef.current.find((proposal) => proposal.id === proposalId)
      if (!target) return

      const isIdea = target.tipo === "idea"
      setVotingId(proposalId)

      try {
        if (target.userHasVoted) {
          const { error } = await (supabase as any)
            .from("propuesta_mejora_voto")
            .delete()
            .eq("propuesta_id", proposalId)
            .eq("usuario_id", currentUserId)

          if (error) throw error

          setProposals((prev) =>
            prev.map((proposal) =>
              proposal.id === proposalId
                ? {
                  ...proposal,
                  votesCount: Math.max(0, proposal.votesCount - 1),
                  userHasVoted: false,
                }
                : proposal,
            ),
          )
          toast.success(
            isIdea ? "Has retirado tu apoyo" : "Has retirado tu confirmación",
          )
        } else {
          const { error } = await (supabase as any)
            .from("propuesta_mejora_voto")
            .insert({ propuesta_id: proposalId, usuario_id: currentUserId })

          if (error) throw error

          setProposals((prev) =>
            prev.map((proposal) =>
              proposal.id === proposalId
                ? {
                  ...proposal,
                  votesCount: proposal.votesCount + 1,
                  userHasVoted: true,
                }
                : proposal,
            ),
          )
          toast.success(
            isIdea ? "¡Gracias por apoyar la idea!" : "Gracias por confirmar el error",
          )
        }
      } catch (voteError) {
        console.error("Error toggling proposal vote", voteError)
        toast.error(
          voteError instanceof Error
            ? voteError.message
            : "No pudimos actualizar tu participación. Inténtalo de nuevo.",
        )
      } finally {
        setVotingId(null)
      }
    },
    [currentUserId],
  )

  const registerComment = useCallback((proposalId: string) => {
    if (!proposalId) return
    setProposals((prev) =>
      prev.map((proposal) =>
        proposal.id === proposalId
          ? {
            ...proposal,
            commentsCount: proposal.commentsCount + 1,
          }
          : proposal,
      ),
    )
  }, [])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  return {
    proposals,
    loading,
    refreshing,
    error,
    createProposal,
    updateProposalStatus,
    toggleVote,
    votingId,
    registerComment,
    refetch: fetchProposals,
    statusLabels: IMPROVEMENT_PROPOSAL_STATUS_LABELS,
  }
}
