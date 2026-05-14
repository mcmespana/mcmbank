"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    async (value: string) => {
      if (!value) return false
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value)
        } else if (typeof document !== "undefined") {
          const textarea = document.createElement("textarea")
          textarea.value = value
          textarea.style.position = "fixed"
          textarea.style.left = "-999999px"
          textarea.style.top = "-999999px"
          document.body.appendChild(textarea)
          textarea.focus()
          textarea.select()
          document.execCommand("copy")
          document.body.removeChild(textarea)
        } else {
          return false
        }

        setCopied(value)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(null), resetMs)
        return true
      } catch (error) {
        console.error("useClipboard: error copying", error)
        return false
      }
    },
    [resetMs],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { copied, copy, isCopied: (value: string) => copied === value }
}
