/**
 * LOCAL DEMO AUTHENTICATION.
 *
 * Accounts live in this browser only. Passwords are salted and hashed with PBKDF2
 * (Web Crypto) before storage, and each user's financial data is stored under a
 * key scoped to their user id, so switching accounts never exposes another user's
 * records in the UI. This is NOT a substitute for server-side auth: anyone with
 * access to the browser profile can read localStorage. For production, replace
 * this module with Supabase Auth + row-level security (see README).
 */
import type { User } from '@/data/types'
import { uid } from '@/lib/id'
import { readJSON, writeJSON, removeKey } from './storage'

const USERS = 'users'
const SESSION = 'session'

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    // Non-secure contexts (plain http on a LAN IP) have no SubtleCrypto.
    let h = 0
    for (const c of salt + password) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
    return 'weak:' + h.toString(16)
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256)
  return toHex(bits)
}

export function listUsers(): User[] {
  return readJSON<User[]>(USERS, [])
}

export function getSessionUser(): User | null {
  const s = readJSON<{ userId: string } | null>(SESSION, null)
  if (!s) return null
  return listUsers().find((u) => u.id === s.userId) ?? null
}

export class AuthError extends Error {}

export async function signUp(name: string, email: string, password: string): Promise<User> {
  const users = listUsers()
  const norm = email.trim().toLowerCase()
  if (users.some((u) => u.email === norm)) throw new AuthError('An account with this email already exists on this device.')
  const salt = uid()
  const user: User = { id: uid('usr'), name: name.trim(), email: norm, salt, passwordHash: await hashPassword(password, salt), createdAt: new Date().toISOString() }
  writeJSON(USERS, [...users, user])
  writeJSON(SESSION, { userId: user.id })
  return user
}

export async function signIn(email: string, password: string): Promise<User> {
  const norm = email.trim().toLowerCase()
  const user = listUsers().find((u) => u.email === norm)
  // Same message for both cases to avoid account enumeration.
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) throw new AuthError('Email or password is incorrect.')
  writeJSON(SESSION, { userId: user.id })
  return user
}

export async function resetPassword(email: string, password: string): Promise<void> {
  const users = listUsers()
  const norm = email.trim().toLowerCase()
  const idx = users.findIndex((u) => u.email === norm)
  if (idx < 0) throw new AuthError('No account with this email exists in this browser.')
  const salt = uid()
  users[idx] = { ...users[idx], salt, passwordHash: await hashPassword(password, salt) }
  writeJSON(USERS, users)
}

export function updateUserProfile(id: string, patch: Partial<Pick<User, 'name' | 'email'>>) {
  const users = listUsers().map((u) => (u.id === id ? { ...u, ...patch, email: (patch.email ?? u.email).toLowerCase() } : u))
  writeJSON(USERS, users)
}

export function signOut() {
  removeKey(SESSION)
}

export const DEMO_EMAIL = 'demo@monetra.app'
export const DEMO_PASSWORD = 'demo-password'

export async function ensureDemoUser(): Promise<User> {
  const existing = listUsers().find((u) => u.email === DEMO_EMAIL)
  if (existing) {
    writeJSON(SESSION, { userId: existing.id })
    return existing
  }
  return signUp('Aarav Mehta', DEMO_EMAIL, DEMO_PASSWORD)
}
