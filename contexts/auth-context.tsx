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

    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (error) {
        console.error("Error getting initial session:", error)
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
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
              await supabase.from("perfil").insert({
                usuario_id: session.user.id,
                nombre_completo: session.user.email?.split("@")[0] || "Usuario",
              })
            }
          } catch (error) {
            console.error("Error creating profile:", error)
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
