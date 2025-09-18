import type { Database } from "./database"

export type ImprovementProposal = Database["public"]["Tables"]["propuesta_mejora"]["Row"]
export type ImprovementProposalInsert = Database["public"]["Tables"]["propuesta_mejora"]["Insert"]
export type ImprovementProposalUpdate = Database["public"]["Tables"]["propuesta_mejora"]["Update"]
export type ImprovementProposalStatus = ImprovementProposal["estado"]

export interface ImprovementProposalWithAuthor extends ImprovementProposal {
  authorName: string
  votesCount: number
  commentsCount: number
  userHasVoted: boolean
}

export interface ImprovementProposalComment {
  id: string
  propuesta_id: string
  contenido: string
  creado_por: string
  creado_por_nombre: string | null
  creado_por_email: string | null
  creado_en: string
}

export const IMPROVEMENT_PROPOSAL_STATUSES: ImprovementProposalStatus[] = [
  "nueva_idea",
  "en_estudio",
  "lo_haremos",
  "en_desarrollo",
  "hechisimo",
]

export const IMPROVEMENT_PROPOSAL_STATUS_LABELS: Record<ImprovementProposalStatus, string> = {
  nueva_idea: "Nueva idea",
  en_estudio: "En estudio",
  lo_haremos: "Lo haremos",
  en_desarrollo: "En desarrollo",
  hechisimo: "Hechísimo",
}
