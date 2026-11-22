import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUserId, ApiError } from './api.ts'
import { supabase } from './supabase.ts'
import { clearPhotoUrls } from './photoUrls.ts'
import type { Me, NeedsOnboarding } from './types.ts'

export type SessionStatus = 'loading' | 'signed_out' | 'needs_onboarding' | 'ready' | 'error'

type Ctx = {
  status: SessionStatus
  me: Me | null
  /** The signed-in phone number while onboarding. */
  phone: string | null
  error: string | null
  /** Demo mode only: pick a sample user. */
  loginAs: (id: string) => void
  reload: () => void
  signOut: () => Promise<void>
}
const SessionCtx = createContext<Ctx>({ status: 'loading', me: null, phone: null, error: null, loginAs: () => {}, reload: () => {}, signOut: async () => {} })
export const useSession = () => useContext(SessionCtx)

/**
 * With Supabase configured: real sign-in by phone OTP, kept across visits (the session refreshes itself).
 * Without it: demo mode, where the sample users can be switched freely.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        if (!data.session) { if (live) { setMe(null); setStatus('signed_out') } return }
      }
      try {
        const r = await api<Me | NeedsOnboarding>('/api/me')
        if (!live) return
        setError(null)
        if (r.user) { setMe(r); setStatus('ready') } else { setMe(null); setPhone(r.phone ?? r.email ?? null); setStatus('needs_onboarding') }
      } catch (e) {
        if (!live) return
        if (supabase && e instanceof ApiError && e.status === 401) { await supabase.auth.signOut().catch(() => {}); setMe(null); setStatus('signed_out'); return }
        setError((e as Error).message); setStatus('error')
      }
    })()
    return () => { live = false }
  }, [tick])

  // a sign-in or sign-out (here or in another tab) re-checks who we are
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTick((t) => t + 1) })
    return () => data.subscription.unsubscribe()
  }, [])

  const loginAs = useCallback((id: string) => { clearPhotoUrls(); setUserId(id); setMe(null); setStatus('loading'); setTick((t) => t + 1) }, [])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut().catch(() => {})
    // a shared phone: the next person must not see the last user's saved lots
    await caches?.delete('api').catch(() => {})
    try { localStorage.removeItem('um_seen_offers') } catch { /* ignore */ }
    clearPhotoUrls()
    setMe(null); setPhone(null); setStatus('signed_out')
  }, [])
  return <SessionCtx.Provider value={{ status, me, phone, error, loginAs, reload, signOut }}>{children}</SessionCtx.Provider>
}
