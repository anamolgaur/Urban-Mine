/** Empty in dev (Vite proxies /api). In production set VITE_API_URL to the API host, e.g. https://urban-mine-api.onrender.com */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')
export const apiUrl = (path: string) => BASE + path

import { supabase } from './supabase.ts'
import { getGuest } from './guest.ts'

const KEY = 'um_user'
export const DEFAULT_USER = 'u-worker-1'

export function getUserId(): string {
  try { return localStorage.getItem(KEY) ?? DEFAULT_USER } catch { return DEFAULT_USER }
}
export function setUserId(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
}

/** An API error. `code` is a stable machine-readable reason such as pending_approval or needs_onboarding. */
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}

/**
 * Who is asking. In the guided Demo mode: the guest pass (lib/guest.ts). Signed in: the Supabase access token
 * (refreshed automatically). Local demo without Supabase: the sample user id.
 */
async function headers(json: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { 'content-type': 'application/json' } : {}
  const guest = getGuest()
  if (guest) {
    h['x-demo-guest'] = guest.token
  } else if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) h.authorization = `Bearer ${data.session.access_token}`
  } else {
    h['x-user-id'] = getUserId()
  }
  return h
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: await headers(opts.body !== undefined),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status, (data as { code?: string }).code)
  return data as T
}

export const authHeaders = () => headers(false)

export async function fetchBlobUrl(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), { headers: await headers(false) })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return URL.createObjectURL(await res.blob())
}
