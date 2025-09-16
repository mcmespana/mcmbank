"use client"

import { useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { LucideIcon } from "lucide-react"
import {
  Lightbulb,
  Sparkles,
  Search as SearchIcon,
  Rocket,
  Hammer,
  PartyPopper,
  Send,
  Filter,
  ThumbsUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import useIsAdmin from "@/hooks/use-is-admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUSES = [
  "Nueva idea",
  "En estudio",
  "Lo haremos",
  "En Desarrollo",
  "Hechísimo",
] as const

type ImprovementProposalStatus = (typeof STATUSES)[number]

const IMPACT_OPTIONS = [
  "Personas usuarias",
  "Gestión interna",
  "Automatización",
  "Comunicación",
] as const

type ImprovementImpact = (typeof IMPACT_OPTIONS)[number]
type ImpactFilter = ImprovementImpact | "todas"

interface ImprovementProposal {
  id: string
  title: string
  description: string
  status: ImprovementProposalStatus
  createdAt: string
  author: {
    id: string
    name: string
    email?: string | null
  }
  impact: ImprovementImpact
  tags: string[]
  votes: number
}

interface StatusConfig {
  icon: LucideIcon
  description: string
  headerClass: string
  headerBadgeClass: string
  badgeClass: string
  accentBarClass: string
  cardClass: string
  iconClass: string
  emptyMessage: string
}

const STATUS_CONFIG: Record<ImprovementProposalStatus, StatusConfig> = {
  "Nueva idea": {
    icon: Sparkles,
    description: "Ideas recién aterrizadas y listas para explorar.",
    headerClass:
      "border border-amber-200/60 bg-amber-50/80 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
    headerBadgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-50",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-50",
    accentBarClass: "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300",
    cardClass:
      "border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white dark:border-amber-400/30 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-transparent",
    iconClass: "text-amber-500 dark:text-amber-200",
    emptyMessage: "Comparte la próxima gran mejora para la plataforma.",
  },
  "En estudio": {
    icon: SearchIcon,
    description: "Estamos analizando la viabilidad de estas propuestas.",
    headerClass:
      "border border-sky-200/60 bg-sky-50/80 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100",
    headerBadgeClass:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-50",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-50",
    accentBarClass: "bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500",
    cardClass:
      "border-sky-200/70 bg-gradient-to-br from-sky-50/80 via-cyan-50/40 to-white dark:border-sky-400/30 dark:from-sky-500/10 dark:via-cyan-500/5 dark:to-transparent",
    iconClass: "text-sky-500 dark:text-sky-200",
    emptyMessage: "Ninguna idea en evaluación todavía. ¡Propon una!",
  },
  "Lo haremos": {
    icon: Rocket,
    description: "Decidimos poner manos a la obra con estas mejoras.",
    headerClass:
      "border border-emerald-200/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    headerBadgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-50",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-50",
    accentBarClass: "bg-gradient-to-r from-emerald-400 via-lime-400 to-emerald-500",
    cardClass:
      "border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-lime-50/40 to-white dark:border-emerald-400/30 dark:from-emerald-500/10 dark:via-lime-500/5 dark:to-transparent",
    iconClass: "text-emerald-500 dark:text-emerald-200",
    emptyMessage: "Pronto habrá ideas comprometidas en esta columna.",
  },
  "En Desarrollo": {
    icon: Hammer,
    description: "Estamos construyendo estas mejoras ahora mismo.",
    headerClass:
      "border border-indigo-200/60 bg-indigo-50/80 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-100",
    headerBadgeClass:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-50",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-50",
    accentBarClass: "bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500",
    cardClass:
      "border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-violet-50/40 to-white dark:border-indigo-400/30 dark:from-indigo-500/10 dark:via-violet-500/5 dark:to-transparent",
    iconClass: "text-indigo-500 dark:text-indigo-200",
    emptyMessage: "Cuando una idea entre en desarrollo la verás aquí.",
  },
  Hechísimo: {
    icon: PartyPopper,
    description: "¡Celebramos las ideas que ya son una realidad!",
    headerClass:
      "border border-purple-200/60 bg-purple-50/80 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-100",
    headerBadgeClass:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-50",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-50",
    accentBarClass: "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500",
    cardClass:
      "border-purple-200/70 bg-gradient-to-br from-purple-50/80 via-fuchsia-50/40 to-white dark:border-purple-400/30 dark:from-purple-500/10 dark:via-fuchsia-500/5 dark:to-transparent",
    iconClass: "text-purple-500 dark:text-purple-200",
    emptyMessage: "Las ideas completadas aparecerán cuando actives el filtro.",
  },
}

const now = Date.now()

const INITIAL_PROPOSALS: ImprovementProposal[] = [
  {
    id: "idea-1",
    title: "Panel de accesos rápidos personalizable",
    description:
      "Permitir que cada delegación configure accesos directos a sus flujos más usados desde el dashboard principal.",
    status: "Nueva idea",
    createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
    author: {
      id: "user-1",
      name: "María Innovación",
      email: "maria@ejemplo.com",
    },
    impact: "Personas usuarias",
    tags: ["experiencia", "dashboard"],
    votes: 15,
  },
  {
    id: "idea-2",
    title: "Indicadores de salud financiera en tiempo real",
    description:
      "Añadir widgets que muestren el pulso económico de la congregación con alertas sobre desviaciones relevantes.",
    status: "En estudio",
    createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
    author: {
      id: "user-2",
      name: "Luis Estrategia",
      email: "luis@ejemplo.com",
    },
    impact: "Gestión interna",
    tags: ["analytics", "alertas"],
    votes: 28,
  },
  {
    id: "idea-3",
    title: "Automatizar conciliación con banca online",
    description:
      "Sincronizar movimientos de las cuentas bancarias para reducir el tiempo de conciliación manual.",
    status: "Lo haremos",
    createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
    author: {
      id: "user-3",
      name: "Ana Procesos",
      email: "ana@ejemplo.com",
    },
    impact: "Automatización",
    tags: ["integraciones", "eficiencia"],
    votes: 34,
  },
  {
    id: "idea-4",
    title: "Espacio de comunicación para delegaciones",
    description:
      "Crear un tablón interno con anuncios del gestor central y novedades destacadas.",
    status: "En Desarrollo",
    createdAt: new Date(now - 1000 * 60 * 60 * 96).toISOString(),
    author: {
      id: "user-4",
      name: "Celia Comunidad",
      email: "celia@ejemplo.com",
    },
    impact: "Comunicación",
    tags: ["comunidad", "colaboración"],
    votes: 22,
  },
  {
    id: "idea-5",
    title: "Resumen mensual automático por email",
    description:
      "Enviar un reporte visual cada mes con el estado de gastos e ingresos principales.",
    status: "Hechísimo",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
    author: {
      id: "user-5",
      name: "Diego Datos",
      email: "diego@ejemplo.com",
    },
    impact: "Comunicación",
    tags: ["reporting", "transparencia"],
    votes: 41,
  },
]

export function ImprovementProposalsBoard() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const [proposals, setProposals] = useState<ImprovementProposal[]>(INITIAL_PROPOSALS)
  const [searchTerm, setSearchTerm] = useState("")
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("todas")
  const [showCompleted, setShowCompleted] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formImpact, setFormImpact] = useState<ImprovementImpact>("Personas usuarias")
  const [formTags, setFormTags] = useState("")

  const filteredProposals = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return proposals.filter((proposal) => {
      const matchesImpact = impactFilter === "todas" || proposal.impact === impactFilter

      if (!normalizedSearch) {
        return matchesImpact
      }

      const hayCoincidencia = [
        proposal.title,
        proposal.description,
        proposal.author.name,
        proposal.author.email ?? "",
        proposal.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)

      return matchesImpact && hayCoincidencia
    })
  }, [impactFilter, proposals, searchTerm])

  const visibleIdeaCount = useMemo(() => {
    return filteredProposals.filter((proposal) => showCompleted || proposal.status !== "Hechísimo").length
  }, [filteredProposals, showCompleted])

  const completedFilteredCount = useMemo(() => {
    return filteredProposals.filter((proposal) => proposal.status === "Hechísimo").length
  }, [filteredProposals])

  const visibleStatuses = useMemo(() => {
    return (showCompleted
      ? STATUSES
      : STATUSES.filter((status) => status !== "Hechísimo")) as ImprovementProposalStatus[]
  }, [showCompleted])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !formTitle.trim() || !formDescription.trim()) {
      return
    }

    const newProposal: ImprovementProposal = {
      id: crypto.randomUUID(),
      title: formTitle.trim(),
      description: formDescription.trim(),
      status: "Nueva idea",
      createdAt: new Date().toISOString(),
      author: {
        id: user.id,
        name: getUserDisplayName(user),
        email: user.email,
      },
      impact: formImpact,
      tags: formTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      votes: 0,
    }

    setProposals((prev) => [newProposal, ...prev])
    setFormTitle("")
    setFormDescription("")
    setFormTags("")
  }

  const handleSupport = (id: string) => {
    setProposals((prev) =>
      prev.map((proposal) =>
        proposal.id === id ? { ...proposal, votes: proposal.votes + 1 } : proposal,
      ),
    )
  }

  const handleStatusChange = (id: string, status: ImprovementProposalStatus) => {
    setProposals((prev) =>
      prev.map((proposal) => (proposal.id === id ? { ...proposal, status } : proposal)),
    )
  }

  const canSubmit = formTitle.trim().length > 0 && formDescription.trim().length > 0

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-primary">
              <Lightbulb className="h-4 w-4" />
              <span>Ideas que transforman MCM Bank</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Propuestas de mejora</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Comparte y vota iniciativas para evolucionar la plataforma. Todas las personas registradas pueden
              proponer ideas sin moderación previa y el equipo gestor las moverá por el flujo.
            </p>
          </div>
          <Badge className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">{visibleIdeaCount}</span>
            <span className="text-xs font-medium uppercase tracking-wide">ideas visibles</span>
          </Badge>
        </div>
        {!showCompleted && completedFilteredCount > 0 && (
          <div className="w-fit rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            {completedFilteredCount === 1
              ? "Hay 1 idea Hechísimo oculta por el filtro"
              : `Hay ${completedFilteredCount} ideas Hechísimo ocultas por el filtro`}
          </div>
        )}
        {isAdmin && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Hammer className="h-4 w-4" />
            <span>Como gestor central puedes actualizar el estado de cada idea desde su tarjeta.</span>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-xl">
            <label htmlFor="search-proposals" className="sr-only">
              Buscar propuestas
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-proposals"
                placeholder="Buscar por título, autor o etiqueta"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={impactFilter}
              onValueChange={(value) => setImpactFilter(value as ImpactFilter)}
              defaultValue="todas"
            >
              <SelectTrigger className="h-10 w-full rounded-full border-muted px-4 text-sm sm:w-56">
                <SelectValue placeholder="Impacto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos los impactos</SelectItem>
                {IMPACT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 gap-2 rounded-full border-primary/30 px-4 text-sm font-medium shadow-sm transition-colors",
                showCompleted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background text-primary hover:bg-primary/10",
              )}
              onClick={() => setShowCompleted((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              {showCompleted ? "Ocultar ideas Hechísimo" : "Ver ideas Hechísimo"}
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-dashed">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Comparte una nueva idea
          </CardTitle>
          <CardDescription>
            Este mural es abierto: cualquier persona con sesión iniciada puede publicar una propuesta. Arrancará en el
            estado «Nueva idea» y la iremos moviendo según avance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label htmlFor="proposal-title" className="text-sm font-medium text-foreground">
                Título de la propuesta
              </label>
              <Input
                id="proposal-title"
                placeholder="¿Qué te gustaría mejorar?"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="proposal-description" className="text-sm font-medium text-foreground">
                Describe la mejora
              </label>
              <Textarea
                id="proposal-description"
                placeholder="Explica el problema y cómo nos ayudaría la propuesta."
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                minLength={20}
                rows={4}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="proposal-impact" className="text-sm font-medium text-foreground">
                  Impacto principal
                </label>
                <Select
                  value={formImpact}
                  onValueChange={(value) => setFormImpact(value as ImprovementImpact)}
                >
                  <SelectTrigger id="proposal-impact" className="h-10 rounded-full border-muted px-4 text-sm">
                    <SelectValue placeholder="Selecciona un impacto" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPACT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="proposal-tags" className="text-sm font-medium text-foreground">
                  Etiquetas (opcional)
                </label>
                <Input
                  id="proposal-tags"
                  placeholder="comunidad, automatización"
                  value={formTags}
                  onChange={(event) => setFormTags(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Sepáralas por comas para agrupar ideas relacionadas.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Las nuevas propuestas empiezan en «Nueva idea» y cualquiera puede apoyarlas desde este panel.
              </p>
              <Button
                type="submit"
                disabled={!user || !canSubmit}
                className="h-10 gap-2 rounded-full px-4 shadow-sm"
                title={user ? undefined : "Inicia sesión para publicar"}
              >
                <Send className="h-4 w-4" />
                Publicar idea
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ScrollArea className="w-full">
        <div className="flex w-max min-w-full gap-6 pb-4">
          {visibleStatuses.map((status) => {
            const statusConfig = STATUS_CONFIG[status]
            const items = filteredProposals.filter((proposal) => proposal.status === status)

            return (
              <section key={status} className="flex w-[320px] flex-shrink-0 flex-col gap-4">
                <div className={cn("rounded-2xl px-4 py-3 shadow-sm", statusConfig.headerClass)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <statusConfig.icon className={cn("h-4 w-4", statusConfig.iconClass)} />
                      <span>{status}</span>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusConfig.headerBadgeClass)}>
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground opacity-80">{statusConfig.description}</p>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center text-sm text-muted-foreground shadow-inner">
                      {statusConfig.emptyMessage}
                    </div>
                  ) : (
                    items.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        statusConfig={statusConfig}
                        isAdmin={isAdmin}
                        onSupport={handleSupport}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}

interface ProposalCardProps {
  proposal: ImprovementProposal
  statusConfig: StatusConfig
  isAdmin: boolean
  onSupport: (id: string) => void
  onStatusChange: (id: string, status: ImprovementProposalStatus) => void
}

function ProposalCard({ proposal, statusConfig, isAdmin, onSupport, onStatusChange }: ProposalCardProps) {
  const since = formatDistanceToNow(new Date(proposal.createdAt), {
    addSuffix: true,
    locale: es,
  })

  const initials = getInitials(proposal.author.name)

  return (
    <Card
      className={cn(
        "relative overflow-hidden border shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg",
        statusConfig.cardClass,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-1", statusConfig.accentBarClass)} />
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold leading-snug">{proposal.title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              {proposal.description}
            </CardDescription>
          </div>
          <statusConfig.icon className={cn("h-6 w-6", statusConfig.iconClass)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {isAdmin ? (
            <Select
              value={proposal.status}
              onValueChange={(value) => onStatusChange(proposal.id, value as ImprovementProposalStatus)}
            >
              <SelectTrigger className="h-8 w-[180px] rounded-full border border-border/60 bg-background/80 px-3 text-xs font-medium shadow-inner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((statusOption) => (
                  <SelectItem key={statusOption} value={statusOption} className="text-xs">
                    {statusOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusConfig.badgeClass)}>
              {proposal.status}
            </Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 rounded-full border border-transparent bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
            onClick={() => onSupport(proposal.id)}
            aria-label="Apoyar esta idea"
          >
            <ThumbsUp className="h-4 w-4" />
            <span>{proposal.votes}</span>
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 p-3 shadow-inner">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{proposal.author.name}</p>
            <p className="text-xs text-muted-foreground">{since}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {proposal.impact}
          </Badge>
          {proposal.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="rounded-full border-muted/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              #{tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getUserDisplayName(user: User | null): string {
  if (!user) return "Usuario"

  const metadataName = (user.user_metadata as { full_name?: string; name?: string })?.full_name
    ?? (user.user_metadata as { full_name?: string; name?: string })?.name

  if (metadataName && metadataName.trim().length > 0) {
    return metadataName
  }

  if (user.email) {
    return user.email.split("@")[0] ?? "Usuario"
  }

  return "Usuario"
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("")
}

