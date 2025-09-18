export function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  if (email) {
    const username = email.split("@")[0]
    const sanitized = username.replace(/\./g, " ")
    const segments = sanitized.split(/\s+/)
    if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase()
    return (segments[0].charAt(0) + segments[segments.length - 1].charAt(0)).toUpperCase()
  }
  return "?"
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSeconds = Math.round(diffMs / 1000)

  const thresholds = [
    { limit: 60, unit: "segundo", seconds: 1 },
    { limit: 3600, unit: "minuto", seconds: 60 },
    { limit: 86400, unit: "hora", seconds: 3600 },
    { limit: 604800, unit: "día", seconds: 86400 },
    { limit: 2629800, unit: "semana", seconds: 604800 },
    { limit: 31557600, unit: "mes", seconds: 2629800 },
  ] as const

  const absoluteSeconds = Math.abs(diffSeconds)

  for (const threshold of thresholds) {
    if (absoluteSeconds < threshold.limit) {
      const amount = Math.floor(absoluteSeconds / threshold.seconds) || 1
      const suffix = amount === 1 ? threshold.unit : `${threshold.unit}s`
      return diffSeconds >= 0 ? `en ${amount} ${suffix}` : `hace ${amount} ${suffix}`
    }
  }

  const years = Math.floor(absoluteSeconds / 31557600)
  return diffSeconds >= 0
    ? `en ${years} ${years === 1 ? "año" : "años"}`
    : `hace ${years} ${years === 1 ? "año" : "años"}`
}
