import type { LucideIcon } from "lucide-react"
import {
  Sparkles,
  Search,
  CalendarCheck,
  Hammer,
  Trophy,
} from "lucide-react"
import type { ImprovementProposalStatus } from "@/lib/types/improvement-proposals"

export interface ImprovementProposalStatusVisualConfig {
  label: string
  description: string
  accentGradient: string
  badgeClassName: string
  headerBackground: string
  icon: LucideIcon
}

export const IMPROVEMENT_PROPOSAL_STATUS_CONFIG: Record<
  ImprovementProposalStatus,
  ImprovementProposalStatusVisualConfig
> = {
  nueva_idea: {
    label: "Nueva idea",
    description: "Chispazos creativos recién llegados",
    accentGradient: "from-pink-500 via-rose-500 to-orange-400",
    badgeClassName:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-500/40",
    headerBackground:
      "bg-gradient-to-br from-rose-500/10 via-orange-400/10 to-transparent",
    icon: Sparkles,
  },
  en_estudio: {
    label: "En estudio",
    description: "Analizando viabilidad y alcance",
    accentGradient: "from-indigo-500 via-purple-500 to-sky-500",
    badgeClassName:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-500/40",
    headerBackground:
      "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent",
    icon: Search,
  },
  lo_haremos: {
    label: "Lo haremos",
    description: "Priorizadas y listas para planificarse",
    accentGradient: "from-amber-400 via-orange-400 to-yellow-500",
    badgeClassName:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40",
    headerBackground:
      "bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-transparent",
    icon: CalendarCheck,
  },
  en_desarrollo: {
    label: "En desarrollo",
    description: "El equipo está construyendo la mejora",
    accentGradient: "from-teal-400 via-cyan-400 to-blue-500",
    badgeClassName:
      "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-100 dark:border-teal-500/40",
    headerBackground:
      "bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-transparent",
    icon: Hammer,
  },
  hechisimo: {
    label: "Hechísimo",
    description: "Listas para celebrarlo 🎉",
    accentGradient: "from-emerald-400 via-lime-400 to-green-500",
    badgeClassName:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40",
    headerBackground:
      "bg-gradient-to-br from-emerald-500/10 via-lime-500/10 to-transparent",
    icon: Trophy,
  },
}
