import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase is optional. With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set, real accounts and
 * cloud sync are used. Without them, the app falls back to the local, browser-only mode.
 * The anon key is public by design: Row Level Security in the database protects the data.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'monetra-auth' },
      })
    : null

export const cloudEnabled = supabase !== null

/** True when a Supabase session token is saved in this browser (used to avoid flashing the landing page). */
export function hasStoredCloudSession(): boolean {
  if (!supabase) return false
  try {
    return !!localStorage.getItem('monetra-auth')
  } catch {
    return false
  }
}
