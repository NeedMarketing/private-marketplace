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
  signup: (data: { fullName: string; email: string; phone: string; password: string }) => Promise<{ ok: boolean; error?: string }>
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

    // Profile fetch is intentionally NOT awaited on the critical path — pages only
    // need user.id to start loading their data. Blocking `loading` on this extra
    // round-trip is what made gated pages slow.
    // Ensure a profiles row ALWAYS exists for the logged-in user. Conversations
    // and messages reference profiles(id); a missing row (e.g. signup before the
    // DB trigger existed) causes message/conversation inserts to fail. We self-heal
    // it here so messaging can never break for that reason. maybeSingle() avoids
    // throwing when the row is absent.
    const fetchProfile = async (u: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, user_type, created_at, updated_at')
        .eq('id', u.id)
        .maybeSingle()

      if (data) { setProfile(data); return }

      // No profile yet — create one from the auth metadata captured at signup.
      const meta = u.user_metadata || {}
      const { data: created } = await supabase
        .from('profiles')
        .upsert({
          id: u.id,
          full_name: (meta.full_name as string) || '',
          phone: (meta.phone as string) || '',
          user_type: 'both',
        })
        .select('id, full_name, phone, user_type, created_at, updated_at')
        .maybeSingle()
      setProfile(created)
    }

    // getSession() reads the session from local storage / cookie (no network),
    // so we can resolve `loading` immediately on first paint.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
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

  const signup = async ({ fullName, email, phone, password }: { fullName: string; email: string; phone: string; password: string }) => {
    const { error } = await createClient().auth.signUp({
      email,
      password,
      // Every account can both buy and sell; user_type defaults to 'both' in the DB.
      options: { data: { full_name: fullName, phone, user_type: 'both' } },
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
      .select('id, full_name, phone, user_type, created_at, updated_at')
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
