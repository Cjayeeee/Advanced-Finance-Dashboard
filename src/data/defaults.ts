import type { Account, Category, Currency, NumberLocale, Workspace, WorkspaceData, WorkspaceType } from './types'
import { uid } from '@/lib/id'
import { CURRENCIES } from '@/lib/money'

/** Muted, warm palette that sits with the ink + sunflower brand colours. */
export const CATEGORY_COLORS = ['#1d1d1b', '#f2c53d', '#b9a77d', '#7c8a5c', '#c47a52', '#6c7a89', '#9fb7a6', '#d8d2c4', '#8c6d8f', '#4f7c8a']

export const CATEGORY_ICONS = [
  'app-window',
  'megaphone',
  'users',
  'laptop',
  'building',
  'plane',
  'briefcase',
  'circle-ellipsis',
  'wallet',
  'repeat',
  'package',
  'landmark',
  'sparkles',
  'graduation-cap',
  'coffee',
  'receipt',
  'heart-pulse',
  'cloud',
] as const

export function defaultCategories(type: WorkspaceType): Category[] {
  const expense: Omit<Category, 'kind'>[] = [
    { id: 'cat_software', name: 'Software & subscriptions', color: '#1d1d1b', icon: 'app-window', system: true },
    { id: 'cat_marketing', name: 'Marketing', color: '#f2c53d', icon: 'megaphone', system: true },
    { id: 'cat_people', name: type === 'startup' ? 'Salaries & contractors' : 'Contractors', color: '#7c8a5c', icon: 'users', system: true },
    { id: 'cat_equipment', name: 'Equipment', color: '#c47a52', icon: 'laptop', system: true },
    { id: 'cat_workspace', name: 'Workspace & utilities', color: '#b9a77d', icon: 'building', system: true },
    { id: 'cat_travel', name: 'Travel', color: '#6c7a89', icon: 'plane', system: true },
    { id: 'cat_professional', name: 'Professional services', color: '#9fb7a6', icon: 'briefcase', system: true },
    { id: 'cat_other_exp', name: 'Other expenses', color: '#d8d2c4', icon: 'circle-ellipsis', system: true },
  ]
  if (type === 'startup') expense.splice(1, 0, { id: 'cat_infra', name: 'Cloud & infrastructure', color: '#4f7c8a', icon: 'cloud', system: true })
  const income: Omit<Category, 'kind'>[] =
    type === 'startup'
      ? [
          { id: 'cat_subscriptions', name: 'Subscription revenue', color: '#1d1d1b', icon: 'repeat', system: true },
          { id: 'cat_services', name: 'Services & onboarding', color: '#f2c53d', icon: 'briefcase', system: true },
          { id: 'cat_other_inc', name: 'Grants & other income', color: '#b9a77d', icon: 'landmark', system: true },
        ]
      : [
          { id: 'cat_client', name: 'Client projects', color: '#1d1d1b', icon: 'briefcase', system: true },
          { id: 'cat_retainer', name: 'Retainers', color: '#f2c53d', icon: 'repeat', system: true },
          { id: 'cat_products', name: 'Digital products', color: '#7c8a5c', icon: 'package', system: true },
          { id: 'cat_other_inc', name: 'Other income', color: '#b9a77d', icon: 'sparkles', system: true },
        ]
  return [...expense.map((c) => ({ ...c, kind: 'expense' as const })), ...income.map((c) => ({ ...c, kind: 'income' as const }))]
}

export function newWorkspace(input: {
  name: string
  type: WorkspaceType
  currency: Currency
  locale?: NumberLocale
  revenueTarget?: number
  isSample?: boolean
}): Workspace {
  return {
    id: uid('ws'),
    name: input.name,
    type: input.type,
    currency: input.currency,
    locale: input.locale ?? CURRENCIES[input.currency].defaultLocale,
    revenueTarget: input.revenueTarget ?? 0,
    burnWindow: 3,
    weekStartsOn: 1,
    invoicePrefix: 'INV-',
    defaultTaxRate: input.currency === 'INR' ? 18 : 0,
    defaultTaxLabel: input.currency === 'INR' ? 'GST' : input.currency === 'USD' ? 'Sales tax' : 'VAT',
    defaultTerms: 'Payment due within 15 days of the invoice date. Bank transfer preferred.',
    isSample: input.isSample ?? false,
    onboarding: { dismissed: false, done: {} },
    createdAt: new Date().toISOString(),
  }
}

export function emptyWorkspaceData(type: WorkspaceType, openingBalance = 0, accountName = 'Main account'): WorkspaceData {
  const accounts: Account[] = [
    { id: uid('acc'), name: accountName, kind: 'bank', openingBalance },
    { id: uid('acc'), name: 'Cash', kind: 'cash', openingBalance: 0 },
  ]
  return { categories: defaultCategories(type), accounts, clients: [], projects: [], transactions: [], invoices: [], budgets: [] }
}
