/**
 * Core domain model.
 *
 * All monetary values are stored as integers in the currency's MINOR unit
 * (paise, cents, pence). Never store floats for money.
 * All calendar dates are ISO strings `YYYY-MM-DD` in the user's local calendar.
 */

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP'
export type NumberLocale = 'en-IN' | 'en-US' | 'en-GB' | 'de-DE'
export type WorkspaceType = 'freelancer' | 'startup'
export type TxType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense'
export type AccountKind = 'bank' | 'card' | 'cash' | 'wallet'
export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  color: string
  icon: string
  /** Built-in categories can be renamed/recoloured but not deleted while in use. */
  system?: boolean
}

export interface Account {
  id: string
  name: string
  kind: AccountKind
  /** Balance when tracking began, minor units. Can be negative (e.g. card debt). */
  openingBalance: number
  archived?: boolean
}

export interface Client {
  id: string
  name: string
  email?: string
  address?: string
  taxId?: string
}

export interface Project {
  id: string
  name: string
  clientId?: string
}

export interface Recurrence {
  frequency: Frequency
  /** Optional last date the recurrence applies to. */
  until?: string
}

export interface Transaction {
  id: string
  type: TxType
  /** Always positive, minor units. Direction is given by `type` and `refund`. */
  amount: number
  date: string
  description: string
  categoryId?: string
  accountId: string
  /** Destination account for transfers. */
  toAccountId?: string
  clientId?: string
  projectId?: string
  notes?: string
  tags: string[]
  recurring?: Recurrence
  /**
   * A refund reverses the direction of its type:
   * - expense refund → money comes back, reduces expenses in that category
   * - income refund  → money returned to a client, reduces income
   */
  refund?: boolean
  /** Set when this income record is a payment against an invoice. */
  invoiceId?: string
  createdAt: string
}

export interface InvoiceLine {
  id: string
  description: string
  /** Up to 2 decimal places (e.g. 7.5 hours). */
  quantity: number
  /** Unit rate, minor units. */
  rate: number
}

export interface Invoice {
  id: string
  number: string
  clientId: string
  projectId?: string
  issueDate: string
  dueDate: string
  lines: InvoiceLine[]
  discount: { type: 'percent' | 'fixed'; value: number }
  /** Percentage, e.g. 18 for 18% GST. Up to 2 decimals. */
  taxRate: number
  taxLabel: string
  notes?: string
  terms?: string
  /** Lifecycle the user controls. Paid / partial / overdue are derived from payments + dates. */
  state: 'draft' | 'issued' | 'void'
  /** Date the user marked it as sent to the client (manual — no email is sent by the app). */
  issuedAt?: string
  createdAt: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void'

export interface Budget {
  id: string
  /** null = overall expense limit */
  categoryId: string | null
  amount: number
  period: 'monthly' | 'custom'
  start?: string
  end?: string
  alertAt: number // percentage, e.g. 80
}

export interface OnboardingState {
  dismissed: boolean
  done: Record<string, boolean>
}

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  currency: Currency
  locale: NumberLocale
  /** Monthly revenue target, minor units. 0 = none. */
  revenueTarget: number
  /** Months of history used for average burn. */
  burnWindow: 3 | 6
  weekStartsOn: 0 | 1
  invoicePrefix: string
  defaultTaxRate: number
  defaultTaxLabel: string
  defaultTerms: string
  businessEmail?: string
  businessAddress?: string
  businessTaxId?: string
  isSample: boolean
  onboarding: OnboardingState
  createdAt: string
}

export interface WorkspaceData {
  categories: Category[]
  accounts: Account[]
  clients: Client[]
  projects: Project[]
  transactions: Transaction[]
  invoices: Invoice[]
  budgets: Budget[]
}

export interface NotificationPrefs {
  budgetAlerts: boolean
  overdueInvoices: boolean
  weeklyDigest: boolean
}

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  salt: string
  createdAt: string
  /** 'cloud' = Supabase account; absent/'local' = browser-only account (also the demo). */
  provider?: 'local' | 'cloud'
}

export interface UserState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  data: Record<string, WorkspaceData>
  prefs: NotificationPrefs
  sidebarCollapsed: boolean
  readNotifications: string[]
  version: number
}
