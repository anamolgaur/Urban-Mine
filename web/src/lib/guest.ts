/**
 * Guest passes for the guided Demo mode (the "Try the demo" button on the sign-in screen).
 *
 * The server hands out a signed, 2-hour pass for one of the shared demo accounts: no password, no sign-up.
 * While a pass is stored, every request sends it in the X-Demo-Guest header instead of a Supabase sign-in
 * (see headers() in api.ts). The server only accepts it for the demo accounts, so it can never reach real data.
 *
 * Kept in sessionStorage, not localStorage: closing the tab ends the demo, so a phone handed to the next
 * person does not stay inside it by accident.
 */
import { apiUrl } from './api.ts'

export type DemoRole = 'worker' | 'recycler' | 'repairer' | 'auditor'
export type Guest = { token: string; role: DemoRole; expires_at: string }

const KEY = 'um_guest'

export function getGuest(): Guest | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Guest | null
    // an expired pass is useless: forget it here so the app does not send it and get refused
    return g && Date.parse(g.expires_at) > Date.now() ? g : null
  } catch { return null }
}

export function clearGuest() {
  try { sessionStorage.removeItem(KEY) } catch { /* private mode */ }
}

/** Ask the server for a pass for this role's demo account, and keep it for this tab. */
export async function startGuest(role: DemoRole): Promise<Guest> {
  // plain fetch, not api(): api() would attach the current pass or sign-in, and this call needs neither
  const res = await fetch(apiUrl('/api/demo/guest'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) })
  const data = await res.json().catch(() => ({})) as Partial<Guest> & { error?: string }
  if (!res.ok || !data.token) throw new Error(data.error ?? `Could not start the demo (${res.status})`)
  const g: Guest = { token: data.token, role, expires_at: data.expires_at ?? new Date(Date.now() + 3600_000).toISOString() }
  try { sessionStorage.setItem(KEY, JSON.stringify(g)) } catch { /* private mode: the pass lives only until reload */ }
  return g
}
