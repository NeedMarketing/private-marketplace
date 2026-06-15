"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

type AuthCtx = {
  user: User | null
  profile: Profile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (data: { fullName: string; email: string; phone: string; password: string; userType: string }) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (data: Partial<Pick<Profile, 'full_name' | 'phone'>>) => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, profile: null, loading: true,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: async () => {},
  updateProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // createClient only called inside useEffect — never during SSR
    const supabase = createClient()

    const fetchProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // createClient() is a singleton — calling it multiple times returns the same instance
  const login = async (email: string, password: string) => {
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const signup = async ({ fullName, email, phone, password, userType }: { fullName: string; email: string; phone: string; password: string; userType: string }) => {
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, user_type: userType } },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const logout = async () => {
    await createClient().auth.signOut()
  }

  const updateProfile = async (data: Partial<Pick<Profile, 'full_name' | 'phone'>>) => {
    if (!user) return
    const { data: updated } = await createClient()
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()
    if (updated) setProfile(updated)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
