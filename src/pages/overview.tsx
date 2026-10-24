import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Inbox, Plus, Search } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useRange } from '@/store/range'
import { useFormat } from '@/hooks/use-format'
import { useTerms } from '@/hooks/use-terms'
import { Tile, TileHeader } from '@/components/tile'
import { EmptyState } from '@/components/empty-state'
import { AnimatedNumber } from '@/components/animated-number'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { CashflowChart } from '@/features/charts/cashflow-chart'
import { BudgetPulse, ExpenseBreakdown, InsightsList, MetricCard, OnboardingChecklist, ReceivablesCard, RunwayCard } from '@/features/overview/widgets'
import { TransactionTable, sortTransactions } from '@/features/transactions/transaction-table'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { autoGranularity, formatRange, inRange, PRESET_LABELS } from '@/lib/dates'
import { balanceSeries, comparisonRanges, insights, invoiceViews, receivables, series, totalBalance, totals } from '@/lib/finance'
import { pctChange } from '@/lib/money'

function cumulative(v: number[]) {
  let s = 0
  return v.map((x) => (s += x))
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function OverviewPage() {
  const { ws, data } = useActiveWorkspace()
  const { user } = useApp()
  const { range, preset } = useRange()
  const { money } = useFormat()
  const terms = useTerms()
  const tx = useTransactionDialog()

  const m = useMemo(() => {
    const { current, previous, partial } = comparisonRanges(range)
    const cur = totals(data.transactions, range)
    const curLike = totals(data.transactions, current)
    const prev = totals(data.transactions, previous)
    const g = autoGranularity(range)
    const s = series(data.transactions, range, g, ws.weekStartsOn).filter((p) => !p.future)
    const balance = totalBalance(data.accounts, data.transactions)
    const balSeries = balanceSeries(data.accounts, data.transactions, current, g).map((p) => p.balance)
    const prevBalance = totalBalance(data.accounts, data.transactions, previous.end)
    const views = invoiceViews(data.invoices, data.transactions)
    return { cur, curLike, prev, partial, previous, s, balance, balSeries, prevBalance, views, rec: receivables(views) }
  }, [data, range, ws.weekStartsOn])

  const ins = useMemo(
    () => insights({ ws, txs: data.transactions, categories: data.categories, clients: data.clients, views: m.views, budgets: data.budgets, balance: m.balance, range, fmt: (v) => money(v) }),
    [ws, data, m.views, m.balance, range, money],
  )

  const firstName = user?.name.split(' ')[0] ?? 'there'
  const periodLabel = preset === 'custom' ? formatRange(range) : PRESET_LABELS[preset].toLowerCase()
  const vs = m.partial ? 'vs same days last period' : 'vs previous period'
  const empty = data.transactions.length === 0
  const inOutTotal = m.cur.income + m.cur.expenses

  return (
    <>
      {/* Greeting */}
      <section className="mb-6 grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end" aria-labelledby="hello">
        <div>
          <h1 id="hello" className="font-display text-[38px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[52px]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted">
            {empty ? (
              <>Welcome to {ws.name}. Record your first transaction and this dashboard fills in.</>
            ) : m.cur.count === 0 ? (
              <>Nothing recorded for {periodLabel} yet. Try a wider period.</>
            ) : (
              <>
                {preset === 'custom' ? `For ${periodLabel}` : `For ${periodLabel}`} you've received <strong className="font-medium text-ink">{money(m.cur.income)}</strong> and spent <strong className="font-medium text-ink">{money(m.cur.expenses)}</strong>, leaving{' '}
                <strong className={m.cur.net >= 0 ? 'font-medium text-gain' : 'font-medium text-loss'}>{money(m.cur.net)}</strong> {m.cur.net >= 0 ? 'in profit' : 'net loss'}.
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:hidden">
            <DateRangePicker />
          </div>
          {inOutTotal > 0 && (
            <div className="mt-5 flex max-w-xl items-center gap-1.5" role="img" aria-label={`Income ${Math.round((m.cur.income / inOutTotal) * 100)}%, expenses ${Math.round((m.cur.expenses / inOutTotal) * 100)}% of money moved`}>
              <span className="flex h-9 min-w-fit items-center whitespace-nowrap rounded-full bg-ink px-3.5 text-[12px] font-medium text-white transition-[flex-grow] duration-700" style={{ flex: `${Math.max(m.cur.income, inOutTotal * 0.18)} 1 0` }}>
                {terms.income} {Math.round((m.cur.income / inOutTotal) * 100)}%
              </span>
              <span className="flex h-9 min-w-fit items-center whitespace-nowrap rounded-full bg-sun px-3.5 text-[12px] font-medium text-ink transition-[flex-grow] duration-700" style={{ flex: `${Math.max(m.cur.expenses, inOutTotal * 0.18)} 1 0` }}>
                Expenses {Math.round((m.cur.expenses / inOutTotal) * 100)}%
              </span>
              <span className="hatch flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[12px] text-ink-3 ring-1 ring-line-strong">
                Margin {m.cur.income > 0 ? Math.round((m.cur.net / m.cur.income) * 100) : 0}%
              </span>
            </div>
          )}
        </div>
        <dl className="flex gap-8 sm:gap-12">
          {[
            { label: 'Transactions', value: m.cur.count },
            { label: 'Open invoices', value: m.rec.openCount },
            { label: terms.clients, value: data.clients.length },
          ].map((s) => (
            <div key={s.label}>
              <dd className="figure text-[48px] sm:text-[64px]">
                <AnimatedNumber value={s.value} format={(n) => String(n)} />
              </dd>
              <dt className="mt-1 text-[12.5px] text-muted">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <OnboardingChecklist />

      {/* Metrics */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
        <MetricCard
          label={`Total ${terms.incomeLower}`}
          value={m.cur.income}
          pct={pctChange(m.curLike.income, m.prev.income)}
          spark={cumulative(m.s.map((p) => p.income))}
          footnote={`${vs}`}
          info="Income transactions received in the period, minus refunds to clients. Unpaid invoices are not included."
          to="/income"
        />
        <MetricCard
          label="Total expenses"
          value={m.cur.expenses}
          pct={pctChange(m.curLike.expenses, m.prev.expenses)}
          goodWhenUp={false}
          spark={cumulative(m.s.map((p) => p.expenses))}
          sparkColor="#e2b41c"
          footnote={`${vs}`}
          info="Expense transactions in the period, minus vendor refunds. Transfers between your accounts are excluded."
          to="/expenses"
        />
        <MetricCard
          label="Net profit"
          value={m.cur.net}
          pct={pctChange(m.curLike.net, m.prev.net)}
          spark={cumulative(m.s.map((p) => p.net))}
          footnote={m.cur.net >= 0 ? 'Cash basis · income − expenses' : 'Net loss · cash basis'}
          info="Simple cash-basis profit: recorded income minus recorded expenses. Not an accrual or tax figure."
          to="/reports"
          variant="sun"
        />
        <MetricCard
          label="Available balance"
          value={m.balance}
          pct={pctChange(m.balance, m.prevBalance)}
          spark={m.balSeries}
          footnote={`Across ${data.accounts.filter((a) => !a.archived).length} accounts · today`}
          info="Opening balances plus all recorded inflows and outflows up to today, across active accounts. This is cash on hand, not profit."
          variant="ink"
          to="/settings/accounts"
        />
      </section>

      {/* Cash flow + action card */}
      <div className="mt-4 grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-8" aria-labelledby="cf-title">
          <TileHeader id="cf-title" title="Cash flow" subtitle={`${terms.income} vs expenses · ${formatRange(range)}`} to="/reports" />
          <CashflowChart range={range} height={340} />
        </Tile>
        <div className="xl:col-span-4">{ws.type === 'startup' ? <RunwayCard balance={m.balance} /> : <ReceivablesCard />}</div>
      </div>

      {/* Breakdown, budget, insights */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="xl:col-span-5">
          <ExpenseBreakdown range={range} />
        </div>
        <div className="xl:col-span-3">
          <BudgetPulse />
        </div>
        <div className="lg:col-span-2 xl:col-span-4">
          <InsightsList items={ins} />
        </div>
      </div>

      {/* Recent transactions */}
      <RecentTransactions onAdd={() => tx.open()} />
    </>
  )
}

function RecentTransactions({ onAdd }: { onAdd: () => void }) {
  const { data } = useActiveWorkspace()
  const { range } = useRange()
  const terms = useTerms()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim().toLowerCase())
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all')
  const [sort, setSort] = useState<{ key: 'date' | 'amount' | 'description'; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })

  const rows = useMemo(() => {
    const filtered = data.transactions.filter((t) => inRange(t.date, range) && (type === 'all' || t.type === type) && (!dq || t.description.toLowerCase().includes(dq)))
    return sortTransactions(filtered, sort).slice(0, 8)
  }, [data.transactions, range, type, dq, sort])

  return (
    <Tile className="mt-4" aria-labelledby="rt-title">
      <TileHeader
        id="rt-title"
        title="Recent transactions"
        subtitle={formatRange(range)}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/transactions">
              View all <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-72">
          <span className="sr-only">Search recent transactions</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search descriptions" className="h-9 w-full rounded-full bg-white/75 pl-10 pr-4 text-[13px] ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-ink" />
        </label>
        <Segmented label="Filter by type" size="sm" value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'income', label: terms.income }, { value: 'expense', label: 'Expenses' }]} />
      </div>
      <TransactionTable
        caption="Recent transactions"
        rows={rows}
        sort={sort}
        onSort={setSort}
        dense
        empty={
          <EmptyState
            icon={<Inbox />}
            title={data.transactions.length === 0 ? 'No transactions yet' : 'Nothing matches'}
            description={data.transactions.length === 0 ? 'Add income or an expense and your dashboard will come alive.' : 'Try a different search, type or period.'}
            action={
              data.transactions.length === 0 && (
                <Button onClick={onAdd}>
                  <Plus /> Add transaction
                </Button>
              )
            }
          />
        }
      />
    </Tile>
  )
}
