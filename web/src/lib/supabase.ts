import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The sign-in client (Supabase Auth, phone OTP). Both values are public by design: the anon key can read nothing,
 * because every database table denies it. Without them the app runs in demo mode with the sample accounts.
 */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

export const authEnabled = supabase !== null
