import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUserId, ApiError } from './api.ts'
import { getGuest, startGuest, saveGuest, clearGuest, type DemoRole, type Guest } from './guest.ts'
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
  /** Guided Demo mode: become the demo account for this role (no account needed). Resolves when the app has switched. */
  startDemo: (role: DemoRole) => Promise<void>
  /**
   * Inside the guided Demo mode: become another role's demo account without the app going blank.
   * The current screen stays until the new account has loaded. `pass` is a pass fetched earlier, if any.
   */
  switchDemo: (role: DemoRole, pass?: Guest | null) => Promise<void>
  /** Leave the guided Demo mode and go back to the sign-in screen. */
  exitDemo: () => Promise<void>
  /** The role the guided Demo mode is showing, or null when not in it. */
  demoRole: DemoRole | null
}
const SessionCtx = createContext<Ctx>({ status: 'loading', me: null, phone: null, error: null, loginAs: () => {}, reload: () => {}, signOut: async () => {}, startDemo: async () => {}, switchDemo: async () => {}, exitDemo: async () => {}, demoRole: null })
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
      // in the guided Demo mode the guest pass stands in for a sign-in
      if (supabase && !getGuest()) {
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
        // the demo pass ran out (2 hours) or the server restarted with a new key: quietly get a fresh one for the same role
        if (e instanceof ApiError && e.code === 'guest_expired') {
          const g = getGuest()
          clearGuest()
          if (g) { try { await startGuest(g.role); setTick((t) => t + 1); return } catch { /* fall through to signed out */ } }
          setMe(null); setStatus('signed_out'); return
        }
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
  const [demoRole, setDemoRole] = useState<DemoRole | null>(() => getGuest()?.role ?? null)
  const startDemo = useCallback(async (role: DemoRole) => {
    await startGuest(role)
    clearPhotoUrls() // photos of the last account must not show in the next one
    setDemoRole(role); setMe(null); setStatus('loading'); setTick((t) => t + 1)
  }, [])
  const switchDemo = useCallback(async (role: DemoRole, pass?: Guest | null) => {
    const old = getGuest()
    const fresh = pass && Date.parse(pass.expires_at) > Date.now() + 60_000 ? pass : null
    if (fresh) saveGuest(fresh); else await startGuest(role)
    try {
      const r = await api<Me | NeedsOnboarding>('/api/me')
      if (!r.user) throw new Error('demo account missing')
      clearPhotoUrls() // photos of the last account must not show in the next one
      setMe(r); setDemoRole(role); setStatus('ready')
    } catch (e) {
      // keep the old account working if the switch fails, and let the guide show the error
      if (old) saveGuest(old)
      throw e
    }
  }, [])
  const signOut = useCallback(async () => {
    clearGuest(); setDemoRole(null)
    if (supabase) await supabase.auth.signOut().catch(() => {})
    // a shared phone: the next person must not see the last user's saved lots
    await caches?.delete('api').catch(() => {})
    try { localStorage.removeItem('um_seen_offers') } catch { /* ignore */ }
    clearPhotoUrls()
    setMe(null); setPhone(null); setStatus('signed_out')
  }, [])
  const exitDemo = signOut
  return <SessionCtx.Provider value={{ status, me, phone, error, loginAs, reload, signOut, startDemo, switchDemo, exitDemo, demoRole }}>{children}</SessionCtx.Provider>
}
