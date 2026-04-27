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
    console.debug("[auth] AuthProvider mounted at", new Date(mountedAt).toISOString())

    const getInitialSession = async () => {
      try {
        // Hard timeout: if navigator.locks is contended (e.g. autoRefreshToken
        // timer firing on tab resume), getSession() can hang indefinitely.
        // Cap at 8 s; onAuthStateChange will fire later and update user anyway.
        const sessionPromise = supabase.auth.getSession()
        const result = await Promise.race([
          sessionPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("getInitialSession-timeout")), 8000),
          ),
        ])

        const session = (result as any)?.data?.session
        console.debug("[auth] getInitialSession resolved", {
          hasSession: !!session,
          userId: session?.user?.id,
          elapsedMs: Date.now() - mountedAt,
        })
        if (mounted) {
          setUser(prev => {
            if (prev?.id === session?.user?.id) return prev
            return session?.user ?? null
          })
          setLoading(false)
        }
      } catch (error) {
        console.error("[auth] getInitialSession failed:", error)
        if (mounted) {
          // Don't force user=null on timeout — onAuthStateChange may still fire
          // with a valid session. Just unblock the loading flag so other hooks
          // proceed with whatever user value is set (initial null is fine; they
          // re-fetch when user updates).
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.debug("[auth] onAuthStateChange:", event, { userId: session?.user?.id })
      if (mounted) {
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

    return () => {
      mounted = false
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
