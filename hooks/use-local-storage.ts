"use client"

import { useEffect, useState } from "react"

export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(defaultValue)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        setState(JSON.parse(stored) as T)
      }
    } catch (error) {
      console.warn(`No se pudo leer ${key} desde localStorage`, error)
    }
  }, [key])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn(`No se pudo guardar ${key} en localStorage`, error)
    }
  }, [key, state])

  return [state, setState] as const
}
