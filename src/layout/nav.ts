import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChartNoAxesColumn, FileText, LayoutGrid, Settings, Target, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, description: 'Your financial snapshot' },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, description: 'Every record, searchable' },
  { to: '/income', label: 'Income', icon: ArrowDownLeft, description: 'Revenue and receivables' },
  { to: '/expenses', label: 'Expenses', icon: ArrowUpRight, description: 'Where money goes' },
  { to: '/invoices', label: 'Invoices', icon: FileText, description: 'Bill clients, track payments' },
  { to: '/budgets', label: 'Budgets', icon: Target, description: 'Spending limits' },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesColumn, description: 'P&L, cash flow, trends' },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Workspace & preferences' },
]

export function titleFor(pathname: string, startup: boolean): { title: string; crumb?: string } {
  if (pathname === '/') return { title: 'Overview' }
  if (pathname.startsWith('/invoices/new')) return { title: 'New invoice', crumb: 'Invoices' }
  if (/^\/invoices\/[^/]+\/edit/.test(pathname)) return { title: 'Edit invoice', crumb: 'Invoices' }
  if (/^\/invoices\/[^/]+/.test(pathname)) return { title: 'Invoice', crumb: 'Invoices' }
  if (pathname.startsWith('/settings')) return { title: 'Settings' }
  const item = NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to))
  if (item?.to === '/income' && startup) return { title: 'Revenue' }
  return { title: item?.label ?? 'Monetra' }
}

/** Pages where the global reporting period applies. */
export const RANGE_PAGES = ['/', '/transactions', '/income', '/expenses', '/reports']
