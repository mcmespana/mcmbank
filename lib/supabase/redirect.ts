const PROTOCOL_REGEX = /^https?:\/\//i

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withProtocol = PROTOCOL_REGEX.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/$/, "")
}

export const getAppBaseUrl = ({
  origin,
  fallbackToWindow = false,
}: {
  origin?: string
  fallbackToWindow?: boolean
} = {}) => {
  const envUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
  if (envUrl) return envUrl

  const originUrl = normalizeBaseUrl(origin)
  if (originUrl) return originUrl

  if (fallbackToWindow && typeof window !== "undefined") {
    return window.location.origin
  }

  return ""
}

export const getAuthCallbackUrl = ({
  origin,
  fallbackToWindow = false,
}: {
  origin?: string
  fallbackToWindow?: boolean
} = {}) => {
  const baseUrl = getAppBaseUrl({ origin, fallbackToWindow })
  return baseUrl ? `${baseUrl}/auth/callback` : "/auth/callback"
}

export const getDebugAuthConfig = ({
  origin,
  fallbackToWindow = false,
}: {
  origin?: string
  fallbackToWindow?: boolean
} = {}) => {
  const baseUrl = getAppBaseUrl({ origin, fallbackToWindow })

  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    devRedirectUrl: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? "",
    origin: origin ?? (fallbackToWindow && typeof window !== "undefined" ? window.location.origin : ""),
    normalizedBaseUrl: baseUrl,
    oauthCallbackUrl: baseUrl ? `${baseUrl}/auth/callback` : "",
    hasProtocol:
      !!process.env.NEXT_PUBLIC_SITE_URL && PROTOCOL_REGEX.test(process.env.NEXT_PUBLIC_SITE_URL.trim()),
  }
}
