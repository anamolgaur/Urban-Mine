import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUserId } from './api.ts'
import type { Me } from './types.ts'

type Ctx = { me: Me | null; error: string | null; loginAs: (id: string) => void; reload: () => void }
const SessionCtx = createContext<Ctx>({ me: null, error: null, loginAs: () => {}, reload: () => {} })
export const useSession = () => useContext(SessionCtx)

/** Demo identity only: pick a sample user. Real sign-in (OTP) is not built. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    api<Me>('/api/me').then((m) => { if (live) { setMe(m); setError(null) } }).catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [tick])

  const loginAs = useCallback((id: string) => { setUserId(id); setMe(null); setTick((t) => t + 1) }, [])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return <SessionCtx.Provider value={{ me, error, loginAs, reload }}>{children}</SessionCtx.Provider>
}
