const KEY = 'um_user'
export const DEFAULT_USER = 'u-worker-1'

export function getUserId(): string {
  try { return localStorage.getItem(KEY) ?? DEFAULT_USER } catch { return DEFAULT_USER }
}
export function setUserId(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
}

const headers = (json: boolean): Record<string, string> => ({ 'x-user-id': getUserId(), ...(json ? { 'content-type': 'application/json' } : {}) })

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: headers(opts.body !== undefined),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

export async function fetchBlobUrl(path: string): Promise<string> {
  const res = await fetch(path, { headers: headers(false) })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return URL.createObjectURL(await res.blob())
}
