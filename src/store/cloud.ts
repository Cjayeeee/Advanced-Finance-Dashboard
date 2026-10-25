/**
 * Supabase-backed auth and storage.
 *
 * Step 1 of the migration: each user's whole app state (workspaces, transactions, invoices,
 * budgets…) is stored as one JSON document in `public.user_state`, protected by Row Level
 * Security so a user can only ever read or write their own row. See supabase/migrations.
 */
import type { User as SupaUser } from '@supabase/supabase-js'
import type { User, UserState } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { AuthError } from './auth'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export function toUser(u: SupaUser): User {
  const meta = (u.user_metadata ?? {}) as { name?: string }
  return {
    id: u.id,
    name: meta.name || u.email?.split('@')[0] || 'You',
    email: u.email ?? '',
    passwordHash: '',
    salt: '',
    createdAt: u.created_at,
    provider: 'cloud',
  }
}

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link we sent.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Try signing in.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.'
  if (m.includes('password should be')) return message
  if (m.includes('failed to fetch') || m.includes('network')) return "Couldn't reach the server. Check your connection and try again."
  return message
}

export class NeedsConfirmation extends Error {}

const redirect = (path: string) => (typeof window !== 'undefined' ? window.location.origin + path : undefined)

export async function cloudSignUp(name: string, email: string, password: string): Promise<User> {
  const { data, error } = await client().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: redirect('/') },
  })
  if (error) throw new AuthError(friendly(error.message))
  if (!data.session || !data.user) throw new NeedsConfirmation(email.trim().toLowerCase())
  return toUser(data.user)
}

export async function cloudSignIn(email: string, password: string): Promise<User> {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new AuthError(friendly(error.message))
  return toUser(data.user)
}

export async function cloudSignOut() {
  await client().auth.signOut()
}

export async function cloudSendReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirect('/reset-password') })
  if (error) throw new AuthError(friendly(error.message))
}

export async function cloudUpdatePassword(password: string) {
  const { error } = await client().auth.updateUser({ password })
  if (error) throw new AuthError(friendly(error.message))
}

export async function cloudUpdateProfile(patch: { name?: string; email?: string }): Promise<{ user: User; emailPending: boolean }> {
  const { data, error } = await client().auth.updateUser({ ...(patch.email ? { email: patch.email.trim().toLowerCase() } : {}), data: patch.name ? { name: patch.name } : undefined })
  if (error) throw new AuthError(friendly(error.message))
  const emailPending = !!patch.email && data.user.email !== patch.email.trim().toLowerCase()
  return { user: toUser(data.user), emailPending }
}

export async function loadRemoteState(userId: string): Promise<{ state: UserState; updatedAt: string } | null> {
  const { data, error } = await client().from('user_state').select('state, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { state: data.state as UserState, updatedAt: data.updated_at as string }
}

export async function saveRemoteState(userId: string, state: UserState): Promise<string> {
  const { data, error } = await client()
    .from('user_state')
    .upsert({ user_id: userId, state }, { onConflict: 'user_id' })
    .select('updated_at')
    .single()
  if (error) throw error
  return data.updated_at as string
}
