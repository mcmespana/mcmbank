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
    const mountedAt = Date.now()
    let initialEventReceived = false
    console.debug("[auth] AuthProvider mounted at", new Date(mountedAt).toISOString())

    // We do NOT call supabase.auth.getSession() directly. HAR + console traces
    // showed it hanging 8+ seconds (getInitialSession-timeout) due to a
    // navigator.locks/BroadcastChannel deadlock that survives cross-page-load.
    // Instead we rely on onAuthStateChange firing INITIAL_SESSION on subscribe,
    // which delivers the current session via the same internal mechanism but
    // through an event channel that's more resilient to lock contention.

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.debug("[auth] onAuthStateChange:", event, {
        userId: session?.user?.id,
        elapsedMs: Date.now() - mountedAt,
      })
      if (mounted) {
        initialEventReceived = true
        setUser(prev => {
          if (prev?.id === session?.user?.id) return prev
          return session?.user ?? null
        })
        setLoading(false)

        if (event === "SIGNED_IN" && session?.user) {
          try {
            // Check if profile exists, create if not
            const { data: profile } = await supabase
              .from("perfil")
              .select("usuario_id")
              .eq("usuario_id", session.user.id)
              .single()

            if (!profile) {
              await (supabase as any).from("perfil").insert({
                usuario_id: session.user.id,
                nombre_completo: session.user.email?.split("@")[0] || "Usuario",
              })
            }
          } catch (error) {
            // Silently fail if profile creation fails (e.g., table doesn't exist yet or RLS issues)
            // This ensures the user can still log in even if profile setup has issues
            console.warn("Profile creation/check failed:", error)
          }
        }
      }
    })

    // Safety net: if onAuthStateChange's INITIAL_SESSION event doesn't fire
    // within 6 s (which would mean the lock is wedged even for event delivery),
    // unblock the loading flag so the StuckRecoveryBanner can take over.
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
