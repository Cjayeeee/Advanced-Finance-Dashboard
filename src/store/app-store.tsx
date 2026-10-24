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

interface AppContextValue {
  user: User | null
  state: UserState | null
  ready: boolean
  saveError: boolean
  // auth
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  loginDemo: (type?: WorkspaceType) => Promise<void>
  logout: () => void
  updateProfile: (patch: { name?: string; email?: string }) => void
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
  const [user, setUser] = useState<User | null>(() => auth.getSessionUser())
  const [state, setState] = useState<UserState | null>(() => (user ? loadUserState(user.id) : null))
  const [saveError, setSaveError] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)

  // Persist (debounced) — always keyed to the signed-in user.
  useEffect(() => {
    if (!user || !state) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveError(!writeJSON(userKey(user.id), state)), 150)
    return () => window.clearTimeout(saveTimer.current)
  }, [user, state])

  // Flush on tab close.
  useEffect(() => {
    const flush = () => user && state && writeJSON(userKey(user.id), state)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [user, state])

  const startSession = useCallback((u: User) => {
    setUser(u)
    setState(loadUserState(u.id))
  }, [])

  const login = useCallback(async (email: string, password: string) => startSession(await auth.signIn(email, password)), [startSession])
  const signup = useCallback(async (name: string, email: string, password: string) => startSession(await auth.signUp(name, email, password)), [startSession])

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
  }, [])

  const logout = useCallback(() => {
    if (user && state) writeJSON(userKey(user.id), state)
    auth.signOut()
    setUser(null)
    setState(null)
  }, [user, state])

  const updateProfile = useCallback(
    (patch: { name?: string; email?: string }) => {
      if (!user) return
      auth.updateUserProfile(user.id, patch)
      setUser(auth.getSessionUser())
    },
    [user],
  )

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
      ready: true,
      saveError,
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
    [user, state, saveError, login, signup, loginDemo, logout, updateProfile, createWorkspace, switchWorkspace, updateWorkspace, deleteWorkspace, resetSampleData, clearWorkspaceData, setPrefs, setSidebarCollapsed, markNotificationsRead, completeStep, updateData],
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
