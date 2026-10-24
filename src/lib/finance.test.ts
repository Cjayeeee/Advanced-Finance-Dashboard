import { describe, expect, it } from 'vitest'
import type { Account, Invoice, Transaction } from '@/data/types'
import { formatMoney, parseMoney, percentOf, toInputString, pctChange } from './money'
import { addMonths, buckets, endOfMonth, previousRange, presetRange } from './dates'
import {
  accountBalances,
  budgetUsage,
  burn,
  byCategory,
  comparisonRanges,
  findDuplicates,
  invoiceAmounts,
  invoiceStatus,
  invoiceViews,
  lineTotal,
  receivables,
  recurringItems,
  series,
  totals,
} from './finance'
import { sampleWorkspace } from '@/data/seed'

const t = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  type: 'expense',
  amount: 0,
  date: '2026-10-10',
  description: 'x',
  accountId: 'a',
  tags: [],
  createdAt: '',
  ...p,
})

describe('money', () => {
  it('parses without float error', () => {
    expect(parseMoney('0.1')).toBe(10)
    expect(parseMoney('1,250.55')).toBe(125055)
    expect(parseMoney('₹ 12,34,567.8')).toBe(123456780)
    expect(parseMoney('19.99')).toBe(1999)
    expect(parseMoney('1.234')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
  })
  it('round-trips input strings', () => {
    expect(toInputString(125050)).toBe('1250.50')
    expect(toInputString(100)).toBe('1')
  })
  it('formats INR with lakh grouping', () => {
    expect(formatMoney(12345678900, 'INR', 'en-IN')).toBe('₹12,34,56,789')
    expect(formatMoney(-150, 'USD', 'en-US')).toBe('−$1.50')
    expect(formatMoney(25000000, 'INR', 'en-IN', { compact: true })).toBe('₹2.5L')
  })
  it('percent of is integer-safe', () => {
    expect(percentOf(10000, 18)).toBe(1800)
    expect(percentOf(333, 18)).toBe(60) // 59.94 → 60
    expect(percentOf(100000, 12.5)).toBe(12500)
  })
  it('pctChange handles zero base', () => {
    expect(pctChange(10, 0)).toBeNull()
    expect(pctChange(0, 0)).toBe(0)
    expect(pctChange(110, 100)).toBeCloseTo(10)
  })
})

describe('dates', () => {
  it('clamps month ends', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')
  })
  it('previous range of calendar months', () => {
    expect(previousRange({ start: '2026-08-01', end: '2026-10-31' })).toEqual({ start: '2026-05-01', end: '2026-07-31' })
    expect(previousRange({ start: '2026-10-05', end: '2026-10-14' })).toEqual({ start: '2026-09-25', end: '2026-10-04' })
  })
  it('like-for-like comparison for partial month', () => {
    const r = presetRange('this-month', '2026-10-24')
    const c = comparisonRanges(r, '2026-10-24')
    expect(c.current).toEqual({ start: '2026-10-01', end: '2026-10-24' })
    expect(c.previous).toEqual({ start: '2026-09-01', end: '2026-09-24' })
    expect(c.partial).toBe(true)
  })
  it('buckets cover the range', () => {
    const b = buckets({ start: '2026-01-01', end: '2026-12-31' }, 'month')
    expect(b).toHaveLength(12)
    expect(b[1].end).toBe('2026-02-28')
  })
})

describe('classification', () => {
  const txs = [
    t({ type: 'income', amount: 100000 }),
    t({ type: 'expense', amount: 30000, categoryId: 'soft' }),
    t({ type: 'expense', amount: 5000, categoryId: 'soft', refund: true }),
    t({ type: 'transfer', amount: 50000, accountId: 'a', toAccountId: 'b' }),
    t({ type: 'income', amount: 10000, refund: true }),
  ]
  it('excludes transfers and nets refunds', () => {
    const r = totals(txs)
    expect(r.income).toBe(90000)
    expect(r.expenses).toBe(25000)
    expect(r.net).toBe(65000)
    expect(r.netCashFlow).toBe(65000)
    expect(r.inflow).toBe(105000)
    expect(r.outflow).toBe(40000)
  })
  it('category breakdown nets refunds', () => {
    const c = byCategory(txs, { start: '2026-01-01', end: '2026-12-31' }, 'expense')
    expect(c[0]).toMatchObject({ id: 'soft', total: 25000, share: 1 })
  })
  it('transfers move balances but not totals', () => {
    const accounts: Account[] = [
      { id: 'a', name: 'A', kind: 'bank', openingBalance: 100000 },
      { id: 'b', name: 'B', kind: 'card', openingBalance: -50000 },
    ]
    const m = accountBalances(accounts, txs, '2026-12-31')
    expect(m.get('a')).toBe(100000 + 100000 - 30000 + 5000 - 50000 - 10000)
    expect(m.get('b')).toBe(0)
  })
  it('series buckets sum to totals', () => {
    const r = { start: '2026-10-01', end: '2026-10-31' }
    const s = series(txs, r, 'week')
    expect(s.reduce((a, p) => a + p.net, 0)).toBe(totals(txs, r).net)
  })
  it('flags duplicates', () => {
    const a = t({ amount: 999, description: 'Figma' })
    const b = t({ amount: 999, description: 'figma ' })
    const c = t({ amount: 999, description: 'Notion' })
    const d = findDuplicates([a, b, c])
    expect(d.has(a.id) && d.has(b.id)).toBe(true)
    expect(d.has(c.id)).toBe(false)
  })
})

describe('invoices', () => {
  const inv: Invoice = {
    id: 'i1',
    number: 'INV-1',
    clientId: 'c',
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    lines: [
      { id: '1', description: 'Design', quantity: 7.5, rate: 250000 },
      { id: '2', description: 'QA', quantity: 1, rate: 33333 },
    ],
    discount: { type: 'percent', value: 10 },
    taxRate: 18,
    taxLabel: 'GST',
    state: 'issued',
    createdAt: '',
  }
  it('computes totals exactly', () => {
    expect(lineTotal(7.5, 250000)).toBe(1875000)
    const a = invoiceAmounts(inv)
    expect(a.subtotal).toBe(1908333)
    expect(a.discount).toBe(190833)
    expect(a.taxable).toBe(1717500)
    expect(a.tax).toBe(309150)
    expect(a.total).toBe(2026650)
  })
  it('derives status from payments, never double counts', () => {
    const total = invoiceAmounts(inv).total
    expect(invoiceStatus(inv, 0, '2026-10-10')).toBe('sent')
    expect(invoiceStatus(inv, 1000, '2026-10-10')).toBe('partial')
    expect(invoiceStatus(inv, 1000, '2026-10-20')).toBe('overdue')
    expect(invoiceStatus(inv, total, '2026-10-20')).toBe('paid')
    expect(invoiceStatus({ ...inv, state: 'draft' }, 0, '2026-12-01')).toBe('draft')

    const pay = t({ type: 'income', amount: 1000000, invoiceId: 'i1', date: '2026-10-05' })
    const views = invoiceViews([inv], [pay], '2026-10-10')
    expect(views[0].paid).toBe(1000000)
    expect(views[0].outstanding).toBe(total - 1000000)
    const rec = receivables(views)
    expect(rec.invoiced).toBe(total)
    expect(rec.received).toBe(1000000)
    // Revenue counts the payment exactly once, invoice issuance adds nothing
    expect(totals([pay]).income).toBe(1000000)
  })
})

describe('budgets, burn & recurring', () => {
  it('budget utilisation & state', () => {
    const txs = [t({ amount: 8500, categoryId: 'soft', date: '2026-10-03' }), t({ amount: 9999, categoryId: 'other', date: '2026-10-03' })]
    const u = budgetUsage({ id: 'b', categoryId: 'soft', amount: 10000, period: 'monthly', alertAt: 80 }, txs, '2026-10-24')
    expect(u.spent).toBe(8500)
    expect(u.state).toBe('warning')
    expect(u.ratio).toBeCloseTo(0.85)
  })
  it('burn uses complete months only', () => {
    const txs = [
      t({ amount: 300000, date: '2026-07-10' }),
      t({ amount: 200000, date: '2026-08-10' }),
      t({ type: 'income', amount: 50000, date: '2026-09-10' }),
      t({ amount: 250000, date: '2026-09-11' }),
      t({ amount: 999999, date: '2026-10-11' }), // current month ignored
    ]
    const b = burn(txs, 1200000, 3, '2026-10-24')
    expect(b.monthsUsed).toBe(3)
    expect(b.avgNetBurn).toBe(233300) // rounded to whole units
    expect(b.runwayMonths).toBeCloseTo(1200000 / 233300, 3)
  })
  it('no runway without enough history', () => {
    const b = burn([t({ amount: 1000, date: '2026-09-02' })], 100000, 3, '2026-10-24')
    expect(b.sufficient).toBe(false)
    expect(b.runwayMonths).toBeNull()
  })
  it('recurring next date', () => {
    const r = recurringItems([t({ description: 'Figma', date: '2026-10-03', recurring: { frequency: 'monthly' }, amount: 1250 })], '2026-10-24')
    expect(r[0].next).toBe('2026-11-03')
    expect(r[0].dueCount).toBe(0)
  })
})

describe('sample data integrity', () => {
  for (const type of ['freelancer', 'startup'] as const) {
    it(`${type}: every invoice payment ≤ invoice total and refs exist`, () => {
      const { data } = sampleWorkspace(type, '2026-10-24')
      const views = invoiceViews(data.invoices, data.transactions, '2026-10-24')
      for (const v of views) expect(v.paid).toBeLessThanOrEqual(v.amounts.total)
      const cats = new Set(data.categories.map((c) => c.id))
      const accs = new Set(data.accounts.map((a) => a.id))
      for (const x of data.transactions) {
        if (x.categoryId) expect(cats.has(x.categoryId)).toBe(true)
        expect(accs.has(x.accountId)).toBe(true)
        expect(x.date <= '2026-10-24').toBe(true)
        expect(Number.isInteger(x.amount)).toBe(true)
      }
      expect(views.some((v) => v.status === 'overdue')).toBe(true)
    })
  }
})
