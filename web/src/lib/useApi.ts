import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'

/** Fetch on mount and whenever `path` changes. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!path) return
    let live = true
    api<T>(path).then((d) => { if (live) { setData(d); setError(null) } }).catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading: path !== null && data === null && error === null, reload }
}
