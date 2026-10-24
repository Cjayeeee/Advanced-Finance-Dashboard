import type { Transaction } from '@/data/types'
import { inRange, type DateRange } from './dates'
import { parseMoney } from './money'

export interface TxFilter {
  q: string
  type: 'all' | 'income' | 'expense' | 'transfer'
  categoryId: string
  accountId: string
  clientId: string
  min: string
  max: string
  dupesOnly: boolean
}

export const EMPTY_FILTER: TxFilter = { q: '', type: 'all', categoryId: '', accountId: '', clientId: '', min: '', max: '', dupesOnly: false }

export function activeFilterCount(f: TxFilter) {
  return [f.q, f.type !== 'all', f.categoryId, f.accountId, f.clientId, f.min, f.max, f.dupesOnly].filter(Boolean).length
}

export function applyFilter(txs: Transaction[], f: TxFilter, range: DateRange | null, dupes?: Set<string>): Transaction[] {
  const q = f.q.trim().toLowerCase()
  const min = f.min ? parseMoney(f.min) : null
  const max = f.max ? parseMoney(f.max) : null
  return txs.filter((t) => {
    if (range && !inRange(t.date, range)) return false
    if (f.type !== 'all' && t.type !== f.type) return false
    if (f.categoryId && t.categoryId !== f.categoryId) return false
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false
    if (f.clientId && t.clientId !== f.clientId) return false
    if (min !== null && t.amount < min) return false
    if (max !== null && t.amount > max) return false
    if (f.dupesOnly && !dupes?.has(t.id)) return false
    if (q) {
      const hay = `${t.description} ${t.notes ?? ''} ${t.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
