"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

const THEME_PREFERENCE_KEY = "mcmbank-theme-preference"
const THEME_STATE_KEY = "mcmbank-theme-resolved"

export function ThemeStateWatcher() {
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    if (!theme || typeof window === "undefined") return
    window.localStorage.setItem(THEME_PREFERENCE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!resolvedTheme || typeof window === "undefined") return
    window.localStorage.setItem(THEME_STATE_KEY, resolvedTheme)
  }, [resolvedTheme])

  return null
}
