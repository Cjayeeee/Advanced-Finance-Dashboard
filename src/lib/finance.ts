/**
 * Single source of truth for every financial number shown in the app.
 * Pure functions only. Inputs are integer minor units, outputs are integer minor units.
 *
 * Classification rules
 * ────────────────────
 *  type      refund   income    expenses   cash in   cash out
 *  income    no       +amount   –          +amount   –
 *  income    yes      −amount   –          –         +amount   (money returned to a client)
 *  expense   no       –         +amount    –         +amount
 *  expense   yes      –         −amount    +amount   –         (vendor refund)
 *  transfer  –        –         –          –         –         (moves money between own accounts)
 *
 * Invoices are NOT revenue by themselves. Revenue is recognised only from income
 * transactions; a payment against an invoice is one income transaction carrying
 * `invoiceId`. The invoice's paid amount is derived from those transactions, so
 * a payment can never be counted twice.
 */
import type {
  Account,
  Budget,
  Category,
  Client,
  Invoice,
  InvoiceStatus,
  Transaction,
  Workspace,
} from '@/data/types'
import {
  addMonths,
  addDays,
  buckets,
  daysBetween,
  endOfMonth,
  inRange,
  monthKey,
  parseISO,
  startOfMonth,
  type DateRange,
  type Granularity,
  nextOccurrence,
  todayISO,
} from './dates'
import { pctChange, percentOf } from './money'

/* ───────────────────────────── classification ───────────────────────────── */

export interface Effect {
  income: number
  expense: number
  inflow: number
  outflow: number
}

export function effect(t: Transaction): Effect {
  const a = t.amount
  if (t.type === 'income') return t.refund ? { income: -a, expense: 0, inflow: 0, outflow: a } : { income: a, expense: 0, inflow: a, outflow: 0 }
  if (t.type === 'expense') return t.refund ? { income: 0, expense: -a, inflow: a, outflow: 0 } : { income: 0, expense: a, inflow: 0, outflow: a }
  return { income: 0, expense: 0, inflow: 0, outflow: 0 }
}

export interface Totals {
  income: number
  expenses: number
  /** Simple cash-basis profit: income − expenses (transfers excluded). */
  net: number
  inflow: number
  outflow: number
  /** inflow − outflow. Equal to `net` under the cash-basis rules above. */
  netCashFlow: number
  count: number
}

export function totals(txs: Transaction[], range?: DateRange): Totals {
  let income = 0,
    expenses = 0,
    inflow = 0,
    outflow = 0,
    count = 0
  for (const t of txs) {
    if (range && !inRange(t.date, range)) continue
    if (t.type === 'transfer') continue
    const e = effect(t)
    income += e.income
    expenses += e.expense
    inflow += e.inflow
    outflow += e.outflow
    count++
  }
  return { income, expenses, net: income - expenses, inflow, outflow, netCashFlow: inflow - outflow, count }
}

/* ───────────────────────────── comparison periods ───────────────────────── */

/**
 * For a range that extends into the future (e.g. "this month" on the 24th),
 * comparisons should be like-for-like: 1–24 this month vs 1–24 last month.
 */
export function comparisonRanges(r: DateRange, today = todayISO()): { current: DateRange; previous: DateRange; partial: boolean } {
  const effEnd = r.end > today && r.start <= today ? today : r.end
  const current = { start: r.start, end: effEnd }
  const wholeMonths = r.start === startOfMonth(r.start) && r.end === endOfMonth(r.end)
  if (wholeMonths) {
    const s = parseISO(r.start)
    const e = parseISO(r.end)
    const months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() + 1
    const pStart = addMonths(r.start, -months)
    const pEnd = effEnd === r.end ? endOfMonth(addMonths(r.end, -months)) : addMonths(effEnd, -months)
    return { current, previous: { start: pStart, end: pEnd }, partial: effEnd !== r.end }
  }
  const len = daysBetween(current.start, current.end)
  return { current, previous: { start: addDays(r.start, -len), end: addDays(r.start, -1) }, partial: effEnd !== r.end }
}

/* ───────────────────────────── time series ──────────────────────────────── */

export interface SeriesPoint {
  key: string
  label: string
  fullLabel: string
  start: string
  end: string
  income: number
  expenses: number
  net: number
  count: number
  future: boolean
}

export function series(txs: Transaction[], range: DateRange, g: Granularity, weekStartsOn: 0 | 1 = 1, today = todayISO()): SeriesPoint[] {
  const bs = buckets(range, g, weekStartsOn)
  const pts: SeriesPoint[] = bs.map((b) => ({ ...b, income: 0, expenses: 0, net: 0, count: 0, future: b.start > today }))
  if (pts.length === 0) return pts
  // binary search bucket index by date
  const starts = pts.map((p) => p.start)
  for (const t of txs) {
    if (t.type === 'transfer' || !inRange(t.date, range)) continue
    let lo = 0,
      hi = starts.length - 1,
      idx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (starts[mid] <= t.date) {
        idx = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    const e = effect(t)
    pts[idx].income += e.income
    pts[idx].expenses += e.expense
    pts[idx].count++
  }
  for (const p of pts) p.net = p.income - p.expenses
  return pts
}

/* ───────────────────────────── breakdowns ───────────────────────────────── */

export interface Slice {
  id: string
  total: number
  share: number
  count: number
}

export function byCategory(txs: Transaction[], range: DateRange, kind: 'income' | 'expense'): Slice[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (t.type !== kind || !inRange(t.date, range)) continue
    const e = effect(t)
    const v = kind === 'income' ? e.income : e.expense
    const id = t.categoryId ?? 'uncategorised'
    const cur = map.get(id) ?? { total: 0, count: 0 }
    cur.total += v
    cur.count++
    map.set(id, cur)
  }
  return toSlices(map)
}

export function byClient(txs: Transaction[], range: DateRange): Slice[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (t.type !== 'income' || !inRange(t.date, range)) continue
    const id = t.clientId ?? 'unassigned'
    const cur = map.get(id) ?? { total: 0, count: 0 }
    cur.total += effect(t).income
    cur.count++
    map.set(id, cur)
  }
  return toSlices(map)
}

export function byProject(txs: Transaction[], range: DateRange): Slice[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (t.type !== 'income' || !inRange(t.date, range) || !t.projectId) continue
    const cur = map.get(t.projectId) ?? { total: 0, count: 0 }
    cur.total += effect(t).income
    cur.count++
    map.set(t.projectId, cur)
  }
  return toSlices(map)
}

function toSlices(map: Map<string, { total: number; count: number }>): Slice[] {
  const positive = [...map.values()].reduce((s, v) => s + Math.max(0, v.total), 0)
  return [...map.entries()]
    .map(([id, v]) => ({ id, total: v.total, count: v.count, share: positive > 0 ? Math.max(0, v.total) / positive : 0 }))
    .filter((s) => s.total !== 0)
    .sort((a, b) => b.total - a.total)
}

/* ───────────────────────────── balances ─────────────────────────────────── */

export function accountBalances(accounts: Account[], txs: Transaction[], asOf = todayISO()): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of accounts) m.set(a.id, a.openingBalance)
  for (const t of txs) {
    if (t.date > asOf) continue
    if (t.type === 'transfer') {
      m.set(t.accountId, (m.get(t.accountId) ?? 0) - t.amount)
      if (t.toAccountId) m.set(t.toAccountId, (m.get(t.toAccountId) ?? 0) + t.amount)
      continue
    }
    const e = effect(t)
    m.set(t.accountId, (m.get(t.accountId) ?? 0) + e.inflow - e.outflow)
  }
  return m
}

export function totalBalance(accounts: Account[], txs: Transaction[], asOf = todayISO()): number {
  const m = accountBalances(accounts, txs, asOf)
  let s = 0
  for (const a of accounts) if (!a.archived) s += m.get(a.id) ?? 0
  return s
}

/** Daily closing balance across a range (for sparklines). */
export function balanceSeries(accounts: Account[], txs: Transaction[], range: DateRange, g: Granularity): { key: string; label: string; balance: number }[] {
  const bs = buckets(range, g)
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? -1 : 1))
  let bal = accounts.filter((a) => !a.archived).reduce((s, a) => s + a.openingBalance, 0)
  const active = new Set(accounts.filter((a) => !a.archived).map((a) => a.id))
  let i = 0
  const out: { key: string; label: string; balance: number }[] = []
  for (const b of bs) {
    while (i < sorted.length && sorted[i].date <= b.end) {
      const t = sorted[i++]
      if (t.type === 'transfer') {
        if (active.has(t.accountId)) bal -= t.amount
        if (t.toAccountId && active.has(t.toAccountId)) bal += t.amount
      } else if (active.has(t.accountId)) {
        const e = effect(t)
        bal += e.inflow - e.outflow
      }
    }
    out.push({ key: b.key, label: b.label, balance: bal })
  }
  return out
}

/* ───────────────────────────── invoices ─────────────────────────────────── */

export interface InvoiceAmounts {
  subtotal: number
  discount: number
  taxable: number
  tax: number
  total: number
}

export function lineTotal(quantity: number, rate: number): number {
  // quantity has ≤2 decimals → integer hundredths to keep arithmetic exact
  const q = Math.round(quantity * 100)
  return Math.round((q * rate) / 100)
}

export function invoiceAmounts(inv: Pick<Invoice, 'lines' | 'discount' | 'taxRate'>): InvoiceAmounts {
  const subtotal = inv.lines.reduce((s, l) => s + lineTotal(l.quantity, l.rate), 0)
  const rawDiscount = inv.discount.type === 'percent' ? percentOf(subtotal, inv.discount.value) : Math.round(inv.discount.value)
  const discount = Math.min(Math.max(0, rawDiscount), subtotal)
  const taxable = subtotal - discount
  const tax = percentOf(taxable, inv.taxRate)
  return { subtotal, discount, taxable, tax, total: taxable + tax }
}

export function invoicePayments(invoiceId: string, txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.invoiceId === invoiceId && t.type === 'income').sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function invoicePaid(invoiceId: string, txs: Transaction[]): number {
  return invoicePayments(invoiceId, txs).reduce((s, t) => s + effect(t).income, 0)
}

export function invoiceStatus(inv: Invoice, paid: number, today = todayISO()): InvoiceStatus {
  if (inv.state === 'void') return 'void'
  if (inv.state === 'draft') return 'draft'
  const { total } = invoiceAmounts(inv)
  if (paid >= total && total > 0) return 'paid'
  if (today > inv.dueDate) return 'overdue'
  if (paid > 0) return 'partial'
  return 'sent'
}

export interface InvoiceView {
  invoice: Invoice
  amounts: InvoiceAmounts
  paid: number
  outstanding: number
  status: InvoiceStatus
}

export function invoiceViews(invoices: Invoice[], txs: Transaction[], today = todayISO()): InvoiceView[] {
  const paidMap = new Map<string, number>()
  for (const t of txs) if (t.invoiceId && t.type === 'income') paidMap.set(t.invoiceId, (paidMap.get(t.invoiceId) ?? 0) + effect(t).income)
  return invoices.map((invoice) => {
    const amounts = invoiceAmounts(invoice)
    const paid = paidMap.get(invoice.id) ?? 0
    const status = invoiceStatus(invoice, paid, today)
    const outstanding = status === 'draft' || status === 'void' ? 0 : Math.max(0, amounts.total - paid)
    return { invoice, amounts, paid, outstanding, status }
  })
}

export interface Receivables {
  invoiced: number
  received: number
  outstanding: number
  overdue: number
  overdueCount: number
  openCount: number
}

/** Totals for issued (non-draft, non-void) invoices whose issue date falls in range (or all, if no range). */
export function receivables(views: InvoiceView[], range?: DateRange): Receivables {
  const r: Receivables = { invoiced: 0, received: 0, outstanding: 0, overdue: 0, overdueCount: 0, openCount: 0 }
  for (const v of views) {
    if (v.status === 'draft' || v.status === 'void') continue
    if (range && !inRange(v.invoice.issueDate, range)) continue
    r.invoiced += v.amounts.total
    r.received += Math.min(v.paid, v.amounts.total)
    r.outstanding += v.outstanding
    if (v.outstanding > 0) r.openCount++
    if (v.status === 'overdue') {
      r.overdue += v.outstanding
      r.overdueCount++
    }
  }
  return r
}

/** Aging buckets for outstanding receivables, by days past due. */
export function agingBuckets(views: InvoiceView[], today = todayISO()) {
  const out = { current: 0, d30: 0, d60: 0, d90: 0 }
  for (const v of views) {
    if (v.outstanding <= 0) continue
    const late = daysBetween(v.invoice.dueDate, today) - 1
    if (late <= 0) out.current += v.outstanding
    else if (late <= 30) out.d30 += v.outstanding
    else if (late <= 60) out.d60 += v.outstanding
    else out.d90 += v.outstanding
  }
  return out
}

/* ───────────────────────────── budgets ──────────────────────────────────── */

export function budgetRange(b: Budget, ref = todayISO()): DateRange {
  if (b.period === 'custom' && b.start && b.end) return { start: b.start, end: b.end }
  return { start: startOfMonth(ref), end: endOfMonth(ref) }
}

export interface BudgetUsage {
  budget: Budget
  range: DateRange
  spent: number
  remaining: number
  /** 0..∞ ratio */
  ratio: number
  state: 'ok' | 'warning' | 'over'
  previousSpent: number | null
  /** Estimated spend by period end at the current pace (only for ongoing periods). */
  projected: number | null
}

export function spentIn(txs: Transaction[], range: DateRange, categoryId: string | null): number {
  let s = 0
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t.date, range)) continue
    if (categoryId && t.categoryId !== categoryId) continue
    s += effect(t).expense
  }
  return s
}

export function budgetUsage(b: Budget, txs: Transaction[], ref = todayISO()): BudgetUsage {
  const range = budgetRange(b, ref)
  const spent = spentIn(txs, range, b.categoryId)
  const ratio = b.amount > 0 ? spent / b.amount : 0
  const state = ratio >= 1 ? 'over' : ratio * 100 >= b.alertAt ? 'warning' : 'ok'
  let previousSpent: number | null = null
  if (b.period === 'monthly') {
    const p = addMonths(range.start, -1)
    previousSpent = spentIn(txs, { start: p, end: endOfMonth(p) }, b.categoryId)
  }
  let projected: number | null = null
  if (ref >= range.start && ref < range.end) {
    const elapsed = daysBetween(range.start, ref)
    const total = daysBetween(range.start, range.end)
    projected = elapsed >= 5 ? Math.round((spent / elapsed) * total / 100) * 100 : null
  }
  return { budget: b, range, spent, remaining: b.amount - spent, ratio, state, previousSpent, projected }
}

/* ───────────────────────────── burn & runway ────────────────────────────── */

export interface BurnInfo {
  /** Average monthly net burn (outflow − inflow) over the window; positive = burning cash. */
  avgNetBurn: number
  /** Average monthly gross burn (outflow only). */
  avgGrossBurn: number
  monthsUsed: number
  months: { key: string; inflow: number; outflow: number; net: number }[]
  /** Months of runway, or null when not burning / not enough data. */
  runwayMonths: number | null
  sufficient: boolean
}

/**
 * Burn uses the last N COMPLETE calendar months (the current partial month is excluded
 * so a half-finished month doesn't understate burn). Needs at least 2 months with activity.
 */
export function burn(txs: Transaction[], balance: number, windowMonths: number, today = todayISO()): BurnInfo {
  const months: BurnInfo['months'] = []
  const firstTx = txs.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null)
  for (let i = windowMonths; i >= 1; i--) {
    const s = addMonths(startOfMonth(today), -i)
    if (firstTx && endOfMonth(s) < firstTx) continue
    const t = totals(txs, { start: s, end: endOfMonth(s) })
    if (t.count === 0) continue
    months.push({ key: monthKey(s), inflow: t.inflow, outflow: t.outflow, net: t.outflow - t.inflow })
  }
  const n = months.length
  // Averages are rounded to whole currency units — they're estimates, paise/cents are false precision.
  const avgNetBurn = n ? Math.round(months.reduce((s, m) => s + m.net, 0) / n / 100) * 100 : 0
  const avgGrossBurn = n ? Math.round(months.reduce((s, m) => s + m.outflow, 0) / n / 100) * 100 : 0
  const sufficient = n >= 2
  const runwayMonths = sufficient && avgNetBurn > 0 && balance > 0 ? balance / avgNetBurn : null
  return { avgNetBurn, avgGrossBurn, monthsUsed: n, months, runwayMonths, sufficient }
}

/**
 * Projected month-end balance (an ESTIMATE): current balance + the average daily net
 * cash flow of the last 90 days × days remaining in the month. Null with < 30 days of history.
 */
export function projectMonthEnd(txs: Transaction[], balance: number, today = todayISO()): { value: number; dailyNet: number } | null {
  const start = addDays(today, -89)
  const firstTx = txs.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null)
  if (!firstTx || daysBetween(firstTx, today) < 30) return null
  const effStart = firstTx > start ? firstTx : start
  const t = totals(txs, { start: effStart, end: today })
  const days = daysBetween(effStart, today)
  const dailyNet = t.netCashFlow / days
  const remaining = daysBetween(today, endOfMonth(today)) - 1
  // Already-scheduled future transactions this month are real records — include them.
  const scheduled = totals(txs, { start: addDays(today, 1), end: endOfMonth(today) }).netCashFlow
  const value = Math.round((balance + scheduled + dailyNet * remaining) / 100) * 100
  return { value, dailyNet }
}

/* ───────────────────────────── recurring ────────────────────────────────── */

export interface RecurringItem {
  tx: Transaction
  next: string
  monthlyEquivalent: number
  /** occurrences missed since the last logged entry up to today */
  dueCount: number
}

/** Groups recurring series by description+category; the latest dated entry is the template. */
export function recurringItems(txs: Transaction[], today = todayISO()): RecurringItem[] {
  const latest = new Map<string, Transaction>()
  for (const t of txs) {
    if (!t.recurring) continue
    const k = `${t.type}|${t.description.toLowerCase()}|${t.categoryId ?? ''}`
    const cur = latest.get(k)
    if (!cur || t.date > cur.date) latest.set(k, t)
  }
  const factor = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }
  return [...latest.values()]
    .filter((t) => !t.recurring!.until || t.recurring!.until >= today)
    .map((tx) => {
      const f = tx.recurring!.frequency
      let next = nextOccurrence(tx.date, f)
      let dueCount = 0
      let guard = 0
      while (next <= today && guard++ < 60) {
        if (tx.recurring!.until && next > tx.recurring!.until) break
        dueCount++
        next = nextOccurrence(next, f)
      }
      const firstDue = dueCount > 0 ? nextOccurrence(tx.date, f) : next
      return { tx, next: firstDue, monthlyEquivalent: Math.round(tx.amount * factor[f]), dueCount }
    })
    .sort((a, b) => (a.next < b.next ? -1 : 1))
}

/* ───────────────────────────── data quality ─────────────────────────────── */

/** Same type, amount, date and (case-insensitive) description → probable duplicate. */
export function findDuplicates(txs: Transaction[]): Set<string> {
  const seen = new Map<string, string>()
  const dup = new Set<string>()
  for (const t of txs) {
    const k = `${t.type}|${t.amount}|${t.date}|${t.description.trim().toLowerCase()}|${t.refund ? 1 : 0}`
    const first = seen.get(k)
    if (first) {
      dup.add(first)
      dup.add(t.id)
    } else seen.set(k, t.id)
  }
  return dup
}

/* ───────────────────────────── insights ─────────────────────────────────── */

export interface Insight {
  id: string
  kind: 'fact' | 'estimate' | 'warning' | 'positive'
  title: string
  detail?: string
}

export interface InsightContext {
  ws: Workspace
  txs: Transaction[]
  categories: Category[]
  clients: Client[]
  views: InvoiceView[]
  budgets: Budget[]
  balance: number
  range: DateRange
  fmt: (minor: number) => string
  today?: string
}

export function insights(ctx: InsightContext): Insight[] {
  const today = ctx.today ?? todayISO()
  const out: Insight[] = []
  const catName = (id: string) => ctx.categories.find((c) => c.id === id)?.name ?? 'Uncategorised'
  const { current, previous, partial } = comparisonRanges(ctx.range, today)
  const cur = totals(ctx.txs, current)
  const prev = totals(ctx.txs, previous)
  const periodWord = partial ? 'so far this period' : 'this period'

  if (cur.count < 3) {
    return [{ id: 'insufficient', kind: 'fact', title: 'Not enough activity in this period for insights yet.', detail: 'Add a few transactions or widen the date range.' }]
  }

  // Largest expense category
  const cats = byCategory(ctx.txs, current, 'expense')
  if (cats.length > 0 && cur.expenses > 0) {
    const top = cats[0]
    out.push({
      id: 'top-cat',
      kind: 'fact',
      title: `${catName(top.id)} is your largest expense category ${periodWord}.`,
      detail: `${ctx.fmt(top.total)} · ${Math.round(top.share * 100)}% of expenses`,
    })
  }

  // Biggest category movement vs previous (need meaningful base)
  if (prev.count >= 3) {
    const prevCats = new Map(byCategory(ctx.txs, previous, 'expense').map((s) => [s.id, s.total]))
    let best: { id: string; change: number; delta: number } | null = null
    for (const c of cats) {
      const p = prevCats.get(c.id) ?? 0
      if (p < 100000 && c.total < 100000) continue // ignore tiny categories (< 1,000 major)
      const ch = pctChange(c.total, p)
      if (ch === null) continue
      const delta = c.total - p
      if (Math.abs(ch) >= 10 && (!best || Math.abs(delta) > Math.abs(best.delta))) best = { id: c.id, change: ch, delta }
    }
    if (best) {
      out.push({
        id: 'cat-move',
        kind: best.change > 0 ? 'warning' : 'positive',
        title: `${catName(best.id)} spending ${best.change > 0 ? 'rose' : 'fell'} ${Math.abs(best.change).toFixed(0)}% versus the previous period.`,
        detail: `${best.delta > 0 ? '+' : '−'}${ctx.fmt(Math.abs(best.delta))} ${partial ? '(like-for-like days)' : ''}`.trim(),
      })
    }
  }

  // Revenue target (freelancer) — only for single-month ranges
  const monthRange = ctx.range.start === startOfMonth(ctx.range.start) && ctx.range.end === endOfMonth(ctx.range.start)
  if (ctx.ws.revenueTarget > 0 && monthRange) {
    const pct = Math.round((cur.income / ctx.ws.revenueTarget) * 100)
    out.push({
      id: 'target',
      kind: pct >= 100 ? 'positive' : 'fact',
      title: `You've received ${pct}% of your monthly revenue target.`,
      detail: `${ctx.fmt(cur.income)} of ${ctx.fmt(ctx.ws.revenueTarget)}`,
    })
  }

  // Overdue receivables
  const rec = receivables(ctx.views)
  if (rec.overdueCount > 0) {
    out.push({
      id: 'overdue',
      kind: 'warning',
      title: `${rec.overdueCount} invoice${rec.overdueCount > 1 ? 's are' : ' is'} overdue.`,
      detail: `${ctx.fmt(rec.overdue)} outstanding past due date`,
    })
  }

  // Client concentration (freelancer)
  if (ctx.ws.type === 'freelancer' && cur.income > 0) {
    const cl = byClient(ctx.txs, current)
    if (cl.length >= 2 && cl[0].share >= 0.5) {
      const name = ctx.clients.find((c) => c.id === cl[0].id)?.name ?? 'One client'
      out.push({ id: 'concentration', kind: 'warning', title: `${name} accounts for ${Math.round(cl[0].share * 100)}% of income ${periodWord}.`, detail: 'High dependence on a single client' })
    }
  }

  // Budgets over / near limit
  const usages = ctx.budgets.map((b) => budgetUsage(b, ctx.txs, today))
  const over = usages.filter((u) => u.state === 'over')
  if (over.length) {
    out.push({ id: 'budget-over', kind: 'warning', title: `${over.length} budget${over.length > 1 ? 's have' : ' has'} been exceeded this month.`, detail: over.map((u) => (u.budget.categoryId ? catName(u.budget.categoryId) : 'Overall')).join(', ') })
  }

  // Startup: runway (estimate)
  if (ctx.ws.type === 'startup') {
    const b = burn(ctx.txs, ctx.balance, ctx.ws.burnWindow, today)
    if (b.runwayMonths !== null) {
      out.push({
        id: 'runway',
        kind: 'estimate',
        title: `At your average net burn, cash lasts about ${b.runwayMonths.toFixed(1)} months.`,
        detail: `${ctx.fmt(b.avgNetBurn)}/month net burn, last ${b.monthsUsed} complete months`,
      })
    }
  }

  // Projection (estimate)
  const proj = projectMonthEnd(ctx.txs, ctx.balance, today)
  if (proj) {
    out.push({
      id: 'projection',
      kind: 'estimate',
      title: `At your recent pace, projected month-end balance is ${ctx.fmt(proj.value)}.`,
      detail: 'Based on average daily net cash flow over the last 90 days',
    })
  }

  // Profit margin fact
  if (cur.income > 0) {
    const margin = Math.round((cur.net / cur.income) * 100)
    out.push({ id: 'margin', kind: margin >= 0 ? 'positive' : 'warning', title: `Your cash-basis profit margin is ${margin}% ${periodWord}.`, detail: `${ctx.fmt(cur.net)} net on ${ctx.fmt(cur.income)} income` })
  }

  return out
}
