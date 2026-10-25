import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  Account,
  Budget,
  Category,
  Client,
  Currency,
  Invoice,
  NotificationPrefs,
  Project,
  Transaction,
  User,
  UserState,
  Workspace,
  WorkspaceData,
  WorkspaceType,
} from '@/data/types'
import { emptyWorkspaceData, newWorkspace } from '@/data/defaults'
import { sampleWorkspace } from '@/data/seed'
import { uid } from '@/lib/id'
import { readJSON, writeJSON, removeKey } from './storage'
import * as auth from './auth'
import * as cloud from './cloud'
import { cloudEnabled, supabase } from '@/lib/supabase'

const STATE_VERSION = 1
const userKey = (id: string) => `u:${id}`

function initialUserState(): UserState {
  return {
    workspaces: [],
    activeWorkspaceId: null,
    data: {},
    prefs: { budgetAlerts: true, overdueInvoices: true, weeklyDigest: false },
    sidebarCollapsed: false,
    readNotifications: [],
    version: STATE_VERSION,
  }
}

function loadUserState(userId: string): UserState {
  const s = readJSON<UserState | null>(userKey(userId), null)
  if (!s || s.version !== STATE_VERSION) return initialUserState()
  return s
}

export interface CreateWorkspaceInput {
  name: string
  type: WorkspaceType
  currency: Currency
  openingBalance: number
  accountName?: string
  revenueTarget?: number
  withSample?: boolean
}

type DataUpdater = (d: WorkspaceData) => WorkspaceData

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'offline' | 'error'

interface AppContextValue {
  user: User | null
  state: UserState | null
  /** False only while a cloud session is being restored on first load. */
  ready: boolean
  saveError: boolean
  /** 'local' = browser-only account or demo; the rest describe cloud sync. */
  syncStatus: SyncStatus
  cloud: boolean
  /** True after the user opened a password-reset link from their email. */
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
  // auth
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  loginDemo: (type?: WorkspaceType) => Promise<void>
  logout: () => void
  updateProfile: (patch: { name?: string; email?: string }) => Promise<{ emailPending: boolean }>
  // workspace-level
  createWorkspace: (input: CreateWorkspaceInput) => string
  switchWorkspace: (id: string) => void
  updateWorkspace: (patch: Partial<Workspace>) => void
  deleteWorkspace: (id: string) => void
  resetSampleData: () => void
  clearWorkspaceData: () => void
  setPrefs: (p: Partial<NotificationPrefs>) => void
  setSidebarCollapsed: (v: boolean) => void
  markNotificationsRead: (ids: string[]) => void
  completeStep: (step: string) => void
  // data
  updateData: (fn: DataUpdater) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // A local session (browser-only account or the demo) is restored synchronously; a cloud session asynchronously.
  const [user, setUser] = useState<User | null>(() => auth.getSessionUser())
  const [state, setState] = useState<UserState | null>(() => (user ? loadUserState(user.id) : null))
  const [ready, setReady] = useState(() => !cloudEnabled || !!user)
  const [saveError, setSaveError] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const remoteTimer = useRef<number | undefined>(undefined)
  /** Last state known to be on the server, to skip echo saves and detect changes from other devices. */
  const lastRemote = useRef<{ json: string; updatedAt: string } | null>(null)
  /** Cloud saves are held back until the server copy has been loaded, so a stale cache can't overwrite it. */
  const hydrated = useRef(false)
  const dirty = useRef(false)
  const isCloud = user?.provider === 'cloud'

  // Local cache (debounced) — always keyed to the signed-in user. For cloud users this makes reloads instant.
  useEffect(() => {
    if (!user || !state) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveError(!writeJSON(userKey(user.id), state)), 150)
    return () => window.clearTimeout(saveTimer.current)
  }, [user, state])

  // Flush the local cache on tab close.
  useEffect(() => {
    const flush = () => user && state && writeJSON(userKey(user.id), state)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [user, state])

  const pushRemote = useCallback(async (uid: string, s: UserState) => {
    const json = JSON.stringify(s)
    try {
      const updatedAt = await cloud.saveRemoteState(uid, s)
      lastRemote.current = { json, updatedAt }
      dirty.current = false
      setSyncStatus('saved')
    } catch {
      setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    }
  }, [])

  // Cloud save (debounced 800ms after the last change).
  useEffect(() => {
    if (!user || !state || user.provider !== 'cloud' || !hydrated.current) return
    if (lastRemote.current?.json === JSON.stringify(state)) return
    dirty.current = true
    setSyncStatus('saving')
    window.clearTimeout(remoteTimer.current)
    const uid = user.id
    remoteTimer.current = window.setTimeout(() => void pushRemote(uid, state), 800)
    return () => window.clearTimeout(remoteTimer.current)
  }, [user, state, pushRemote])

  const startCloudSession = useCallback(async (u: User) => {
    auth.signOut() // drop any local/demo session
    hydrated.current = false
    lastRemote.current = null
    const cached = readJSON<UserState | null>(userKey(u.id), null)
    setUser(u)
    setState(cached && cached.version === STATE_VERSION ? cached : initialUserState())
    setSyncStatus('loading')
    try {
      const remote = await cloud.loadRemoteState(u.id)
      if (remote && remote.state?.version === STATE_VERSION) {
        lastRemote.current = { json: JSON.stringify(remote.state), updatedAt: remote.updatedAt }
        setState(remote.state)
        setSyncStatus('saved')
      } else {
        // First cloud sign-in: bring over this browser's data (cached copy, or a local account with the same email).
        let initial: UserState | null = cached && cached.version === STATE_VERSION ? cached : null
        if (!initial) {
          const local = auth.listUsers().find((x) => x.email === u.email && x.email !== auth.DEMO_EMAIL)
          if (local) initial = loadUserState(local.id)
        }
        setState({ ...(initial ?? initialUserState()) }) // new object → triggers the first upload
      }
      hydrated.current = true
    } catch {
      setSyncStatus('offline') // keep working from the cached copy; we retry when the connection returns
    }
  }, [])

  // Restore a cloud session, and listen for auth events (email links, sign-out in another tab, profile updates).
  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        if (data.session?.user && !auth.getSessionUser()) void startCloudSession(cloud.toUser(data.session.user))
        setReady(true)
      })
      .catch(() => setReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setUser((u) => (u?.provider === 'cloud' ? null : u))
      if (event === 'USER_UPDATED' && session?.user) setUser((u) => (u?.provider === 'cloud' ? cloud.toUser(session.user) : u))
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [startCloudSession])

  // Pick up changes made on another device when this tab comes back into view; retry when back online.
  useEffect(() => {
    if (!isCloud || !user) return
    const uid = user.id
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      if (!hydrated.current) {
        // An earlier load failed (offline) — try again.
        const u = user
        return void startCloudSession(u)
      }
      if (dirty.current) return
      try {
        const r = await cloud.loadRemoteState(uid)
        if (r && r.updatedAt !== lastRemote.current?.updatedAt && r.state?.version === STATE_VERSION) {
          lastRemote.current = { json: JSON.stringify(r.state), updatedAt: r.updatedAt }
          setState(r.state)
        }
      } catch {
        /* stay on the current copy */
      }
    }
    const online = () => {
      if (!hydrated.current) return void startCloudSession(user)
      if (dirty.current) setState((s) => (s ? { ...s } : s)) // re-trigger the debounced save
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', online)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', online)
    }
  }, [isCloud, user, startCloudSession])

  const startSession = useCallback((u: User) => {
    setUser(u)
    setState(loadUserState(u.id))
    setSyncStatus('local')
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      if (cloudEnabled) await startCloudSession(await cloud.cloudSignIn(email, password))
      else startSession(await auth.signIn(email, password))
    },
    [startSession, startCloudSession],
  )
  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      if (cloudEnabled) await startCloudSession(await cloud.cloudSignUp(name, email, password))
      else startSession(await auth.signUp(name, email, password))
    },
    [startSession, startCloudSession],
  )

  const loginDemo = useCallback(async (type: WorkspaceType = 'freelancer') => {
    const u = await auth.ensureDemoUser()
    let s = loadUserState(u.id)
    const existing = s.workspaces.find((w) => w.isSample && w.type === type)
    if (existing) {
      s = { ...s, activeWorkspaceId: existing.id }
    } else {
      const { workspace, data } = sampleWorkspace(type)
      s = { ...s, workspaces: [...s.workspaces, workspace], data: { ...s.data, [workspace.id]: data }, activeWorkspaceId: workspace.id }
    }
    writeJSON(userKey(u.id), s)
    setUser(u)
    setState(s)
    setSyncStatus('local')
  }, [])

  const logout = useCallback(() => {
    const u = user
    const s = state
    // Clear the UI first so navigation happens immediately; finish syncing in the background.
    setUser(null)
    setState(null)
    setPasswordRecovery(false)
    if (u?.provider === 'cloud') {
      window.clearTimeout(remoteTimer.current)
      const pending = dirty.current && hydrated.current && s ? cloud.saveRemoteState(u.id, s).catch(() => undefined) : Promise.resolve()
      hydrated.current = false
      lastRemote.current = null
      dirty.current = false
      removeKey(userKey(u.id)) // don't leave financial data cached on a shared device
      void pending.then(() => cloud.cloudSignOut())
    } else {
      if (u && s) writeJSON(userKey(u.id), s)
      auth.signOut()
    }
  }, [user, state])

  const updateProfile = useCallback(
    async (patch: { name?: string; email?: string }) => {
      if (!user) return { emailPending: false }
      if (user.provider === 'cloud') {
        const r = await cloud.cloudUpdateProfile({ name: patch.name, email: patch.email && patch.email.toLowerCase() !== user.email ? patch.email : undefined })
        setUser(r.user)
        return { emailPending: r.emailPending }
      }
      auth.updateUserProfile(user.id, patch)
      setUser(auth.getSessionUser())
      return { emailPending: false }
    },
    [user],
  )

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), [])

  const patchState = useCallback((fn: (s: UserState) => UserState) => setState((s) => (s ? fn(s) : s)), [])

  const createWorkspace = useCallback(
    (input: CreateWorkspaceInput) => {
      let ws: Workspace
      let data: WorkspaceData
      if (input.withSample) {
        const r = sampleWorkspace(input.type)
        ws = { ...r.workspace, name: input.name || r.workspace.name, currency: input.currency }
        if (input.currency !== 'INR') ws.locale = newWorkspace({ name: '', type: input.type, currency: input.currency }).locale
        data = r.data
      } else {
        ws = newWorkspace({ name: input.name, type: input.type, currency: input.currency, revenueTarget: input.revenueTarget })
        data = emptyWorkspaceData(input.type, input.openingBalance, input.accountName)
        if (input.openingBalance) ws.onboarding.done.balance = true
      }
      patchState((s) => ({ ...s, workspaces: [...s.workspaces, ws], data: { ...s.data, [ws.id]: data }, activeWorkspaceId: ws.id }))
      return ws.id
    },
    [patchState],
  )

  const switchWorkspace = useCallback((id: string) => patchState((s) => ({ ...s, activeWorkspaceId: id })), [patchState])

  const updateWorkspace = useCallback(
    (patch: Partial<Workspace>) => patchState((s) => ({ ...s, workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspaceId ? { ...w, ...patch } : w)) })),
    [patchState],
  )

  const deleteWorkspace = useCallback(
    (id: string) =>
      patchState((s) => {
        const workspaces = s.workspaces.filter((w) => w.id !== id)
        const data = { ...s.data }
        delete data[id]
        return { ...s, workspaces, data, activeWorkspaceId: s.activeWorkspaceId === id ? (workspaces[0]?.id ?? null) : s.activeWorkspaceId }
      }),
    [patchState],
  )

  const resetSampleData = useCallback(
    () =>
      patchState((s) => {
        const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
        if (!ws) return s
        const { workspace, data } = sampleWorkspace(ws.type)
        return {
          ...s,
          workspaces: s.workspaces.map((w) => (w.id === ws.id ? { ...workspace, id: ws.id, name: ws.name, isSample: true, onboarding: ws.onboarding } : w)),
          data: { ...s.data, [ws.id]: data },
        }
      }),
    [patchState],
  )

  const clearWorkspaceData = useCallback(
    () =>
      patchState((s) => {
        const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
        if (!ws) return s
        const cur = s.data[ws.id]
        return {
          ...s,
          workspaces: s.workspaces.map((w) => (w.id === ws.id ? { ...w, isSample: false } : w)),
          data: { ...s.data, [ws.id]: { ...emptyWorkspaceData(ws.type), categories: cur.categories, accounts: cur.accounts.map((a) => ({ ...a, openingBalance: 0 })) } },
        }
      }),
    [patchState],
  )

  const setPrefs = useCallback((p: Partial<NotificationPrefs>) => patchState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })), [patchState])
  const setSidebarCollapsed = useCallback((v: boolean) => patchState((s) => ({ ...s, sidebarCollapsed: v })), [patchState])
  const markNotificationsRead = useCallback(
    (ids: string[]) => patchState((s) => ({ ...s, readNotifications: [...new Set([...s.readNotifications, ...ids])].slice(-300) })),
    [patchState],
  )
  const completeStep = useCallback(
    (step: string) =>
      patchState((s) => ({
        ...s,
        workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspaceId && !w.onboarding.done[step] ? { ...w, onboarding: { ...w.onboarding, done: { ...w.onboarding.done, [step]: true } } } : w)),
      })),
    [patchState],
  )

  const updateData = useCallback(
    (fn: DataUpdater) =>
      patchState((s) => {
        const id = s.activeWorkspaceId
        if (!id || !s.data[id]) return s
        return { ...s, data: { ...s.data, [id]: fn(s.data[id]) } }
      }),
    [patchState],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      state,
      ready,
      saveError,
      syncStatus,
      cloud: isCloud,
      passwordRecovery,
      clearPasswordRecovery,
      login,
      signup,
      loginDemo,
      logout,
      updateProfile,
      createWorkspace,
      switchWorkspace,
      updateWorkspace,
      deleteWorkspace,
      resetSampleData,
      clearWorkspaceData,
      setPrefs,
      setSidebarCollapsed,
      markNotificationsRead,
      completeStep,
      updateData,
    }),
    [user, state, ready, saveError, syncStatus, isCloud, passwordRecovery, clearPasswordRecovery, login, signup, loginDemo, logout, updateProfile, createWorkspace, switchWorkspace, updateWorkspace, deleteWorkspace, resetSampleData, clearWorkspaceData, setPrefs, setSidebarCollapsed, markNotificationsRead, completeStep, updateData],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Active workspace + its data + typed mutation helpers. Only use under the authenticated shell. */
export function useWorkspace() {
  const app = useApp()
  const ws = app.state?.workspaces.find((w) => w.id === app.state?.activeWorkspaceId) ?? null
  const data = ws ? app.state!.data[ws.id] : null
  const { updateData, completeStep } = app

  const actions = useMemo(() => {
    const now = () => new Date().toISOString()
    return {
      addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>) {
        const full: Transaction = { ...t, id: uid('tx'), createdAt: now() }
        updateData((d) => ({ ...d, transactions: [full, ...d.transactions] }))
        completeStep('transaction')
        return full
      },
      addTransactions(list: Omit<Transaction, 'id' | 'createdAt'>[]) {
        const full = list.map((t) => ({ ...t, id: uid('tx'), createdAt: now() }))
        updateData((d) => ({ ...d, transactions: [...full, ...d.transactions] }))
      },
      updateTransaction(id: string, patch: Partial<Transaction>) {
        updateData((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
      },
      deleteTransactions(ids: string[]) {
        const set = new Set(ids)
        updateData((d) => ({ ...d, transactions: d.transactions.filter((t) => !set.has(t.id)) }))
      },
      restoreTransactions(list: Transaction[]) {
        updateData((d) => ({ ...d, transactions: [...list, ...d.transactions.filter((t) => !list.some((l) => l.id === t.id))] }))
      },
      // categories
      saveCategory(c: Category) {
        updateData((d) => ({ ...d, categories: d.categories.some((x) => x.id === c.id) ? d.categories.map((x) => (x.id === c.id ? c : x)) : [...d.categories, c] }))
      },
      deleteCategory(id: string, reassignTo?: string) {
        updateData((d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          transactions: d.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: reassignTo } : t)),
          budgets: d.budgets.filter((b) => b.categoryId !== id),
        }))
      },
      // accounts
      saveAccount(a: Account) {
        updateData((d) => ({ ...d, accounts: d.accounts.some((x) => x.id === a.id) ? d.accounts.map((x) => (x.id === a.id ? a : x)) : [...d.accounts, a] }))
      },
      // clients & projects
      saveClient(c: Client) {
        updateData((d) => ({ ...d, clients: d.clients.some((x) => x.id === c.id) ? d.clients.map((x) => (x.id === c.id ? c : x)) : [...d.clients, c] }))
        completeStep('client')
      },
      saveProject(p: Project) {
        updateData((d) => ({ ...d, projects: d.projects.some((x) => x.id === p.id) ? d.projects.map((x) => (x.id === p.id ? p : x)) : [...d.projects, p] }))
      },
      // invoices
      saveInvoice(inv: Invoice) {
        updateData((d) => ({ ...d, invoices: d.invoices.some((x) => x.id === inv.id) ? d.invoices.map((x) => (x.id === inv.id ? inv : x)) : [inv, ...d.invoices] }))
        completeStep('invoice')
      },
      deleteInvoice(id: string, keepPayments: boolean) {
        updateData((d) => ({
          ...d,
          invoices: d.invoices.filter((i) => i.id !== id),
          transactions: keepPayments ? d.transactions.map((t) => (t.invoiceId === id ? { ...t, invoiceId: undefined } : t)) : d.transactions.filter((t) => t.invoiceId !== id),
        }))
      },
      // budgets
      saveBudget(b: Budget) {
        updateData((d) => ({ ...d, budgets: d.budgets.some((x) => x.id === b.id) ? d.budgets.map((x) => (x.id === b.id ? b : x)) : [...d.budgets, b] }))
        completeStep('budget')
      },
      deleteBudget(id: string) {
        updateData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }))
      },
    }
  }, [updateData, completeStep])

  return { ws, data, actions }
}

/** Hook for components that must have a workspace — the shell guarantees it. */
export function useActiveWorkspace() {
  const { ws, data, actions } = useWorkspace()
  if (!ws || !data) throw new Error('No active workspace')
  return { ws, data, actions }
}

export function clearAllLocalData() {
  for (const u of auth.listUsers()) removeKey(userKey(u.id))
  removeKey('users')
  removeKey('session')
  removeKey('ui')
}
