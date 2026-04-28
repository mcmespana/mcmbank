"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let initialEventReceived = false

    // We do NOT call supabase.auth.getSession() directly. Console traces showed
    // it hanging 8+ seconds (navigator.locks/BroadcastChannel deadlock that
    // survives across page loads). Instead we rely on onAuthStateChange firing
    // INITIAL_SESSION on subscribe — same effect via an event channel that's
    // more resilient. See docs/TAB_SWITCH_HANG_FIX.md.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      initialEventReceived = true
      setUser(prev => {
        if (prev?.id === session?.user?.id) return prev
        return session?.user ?? null
      })
      setLoading(false)

      // Profile bootstrap: fire-and-forget so we never block the auth event
      // dispatcher. Awaiting here was observed to wedge subsequent /rest/v1/*
      // queries right after Google OAuth login (post-SIGNED_IN flow).
      if (event === "SIGNED_IN" && session?.user) {
        const userId = session.user.id
        const fallbackName = session.user.email?.split("@")[0] || "Usuario"
        ;(async () => {
          try {
            const { data: profile } = await supabase
              .from("perfil")
              .select("usuario_id")
              .eq("usuario_id", userId)
              .single()
            if (!profile) {
              await (supabase as any).from("perfil").insert({
                usuario_id: userId,
                nombre_completo: fallbackName,
              })
            }
          } catch (error) {
            console.warn("Profile creation/check failed:", error)
          }
        })()
      }
    })

    // Safety net: if onAuthStateChange's INITIAL_SESSION event doesn't fire
    // within 6 s, unblock the loading flag so the rest of the app can render
    // (and either recover or show its own error state).
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialEventReceived) {
        console.warn("[auth] no INITIAL_SESSION within 6s — forcing loading=false")
        setLoading(false)
      }
    }, 6000)

    return () => {
      mounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
