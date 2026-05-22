import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Referral-Code aus URL ?ref=XXX persistent merken (bevor User sich registriert)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref && /^[A-Z0-9]{4,16}$/.test(ref)) {
      localStorage.setItem('earth.ref', ref)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      // Referral einlösen sobald User echt angemeldet ist
      if (event === 'SIGNED_IN' && session?.user) {
        const code = localStorage.getItem('earth.ref')
        if (code) {
          try {
            await supabase.rpc('redeem_referral', { p_user_id: session.user.id, p_code: code })
          } catch {}
          localStorage.removeItem('earth.ref')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithProvider = (provider) =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email, password) =>
    supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signInWithProvider, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
