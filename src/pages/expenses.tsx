import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Inbox, Plus, Repeat, Tags } from 'lucide-react'
import { useActiveWorkspace } from '@/store/app-store'
import { useRange } from '@/store/range'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { PageIntro } from '@/components/page'
import { Tile, TileHeader } from '@/components/tile'
import { EmptyState } from '@/components/empty-state'
import { DateRangePicker } from '@/components/date-range-picker'
import { CategoryIcon } from '@/components/category-icon'
import { Trend } from '@/components/trend'
import { MoneyFigure } from '@/components/money'
import { Button } from '@/components/ui/button'
import { TrendChart } from '@/features/charts/trend-chart'
import { SegmentBar } from '@/features/charts/segment-bar'
import { FilterBar } from '@/features/transactions/filter-bar'
import { TransactionTable, sortTransactions, type SortState } from '@/features/transactions/transaction-table'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { exportTransactionsCSV } from '@/features/transactions/export'
import { CategoryDialog } from '@/features/categories/category-dialog'
import { applyFilter, EMPTY_FILTER, type TxFilter } from '@/lib/filters'
import { budgetUsage, byCategory, comparisonRanges, recurringItems, series, totals } from '@/lib/finance'
import { daysBetween, formatDate, formatRange, presetRange, relativeDays, todayISO } from '@/lib/dates'
import { pctChange } from '@/lib/money'
import { cn } from '@/lib/utils'

export default function ExpensesPage() {
  const { ws, data } = useActiveWorkspace()
  const { range } = useRange()
  const { money } = useFormat()
  const { cat } = useLookups()
  const tx = useTransactionDialog()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<TxFilter>({ ...EMPTY_FILTER, type: 'expense', categoryId: params.get('category') ?? '' })
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [catOpen, setCatOpen] = useState(false)
  const today = todayISO()

  const m = useMemo(() => {
    const { current, previous } = comparisonRanges(range)
    const cur = totals(data.transactions, range)
    const curLike = totals(data.transactions, current)
    const prev = totals(data.transactions, previous)
    const slices = byCategory(data.transactions, range, 'expense')
    const prevMap = new Map(byCategory(data.transactions, previous, 'expense').map((s) => [s.id, s.total]))
    const curLikeMap = new Map(byCategory(data.transactions, current, 'expense').map((s) => [s.id, s.total]))
    const months = series(data.transactions, presetRange('last-12-months'), 'month').map((p) => ({ key: p.key, label: p.label, fullLabel: p.fullLabel, value: p.expenses, future: p.future }))
    const elapsed = daysBetween(current.start, current.end)
    const largest = data.transactions
      .filter((t) => t.type === 'expense' && !t.refund && t.date >= range.start && t.date <= range.end)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
    return { cur, curLike, prev, slices, prevMap, curLikeMap, months, perDay: elapsed > 0 ? Math.round(curLike.expenses / elapsed / 100) * 100 : 0, largest, previous }
  }, [data.transactions, range])

  const budgetsByCat = useMemo(() => new Map(data.budgets.filter((b) => b.categoryId).map((b) => [b.categoryId!, budgetUsage(b, data.transactions, today)])), [data.budgets, data.transactions, today])
  const recurring = useMemo(() => recurringItems(data.transactions).filter((r) => r.tx.type === 'expense' && !r.tx.refund), [data.transactions])
  const recurringMonthly = recurring.reduce((s, r) => s + r.monthlyEquivalent, 0)
  const rows = useMemo(() => sortTransactions(applyFilter(data.transactions, filter, range), sort), [data.transactions, filter, range, sort])
  const top = m.slices[0]
  const avgMonthly = 100 * Math.round(0.01 * m.months.filter((p) => !p.future).reduce((s, p) => s + p.value, 0) / Math.max(1, m.months.filter((p) => !p.future).length))

  return (
    <>
      <PageIntro
        title="Expenses"
        description="Understand where money goes and keep spending in check."
        actions={
          <>
            <DateRangePicker className="sm:hidden" />
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              <Tags /> New category
            </Button>
            <Button onClick={() => tx.open({ defaults: { type: 'expense' } })}>
              <Plus /> Add expense
            </Button>
          </>
        }
      />

      <section aria-label="Expense summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Total expenses</p>
          <MoneyFigure value={m.cur.expenses} className="mt-4 block text-[42px]" />
          <div className="mt-4 flex items-center gap-2">
            <Trend pct={pctChange(m.curLike.expenses, m.prev.expenses)} goodWhenUp={false} />
            <span className="text-[12px] text-muted">vs {formatRange(m.previous)}</span>
          </div>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Daily average</p>
          <MoneyFigure value={m.perDay} className="mt-4 block text-[42px]" />
          <p className="mt-4 text-[12px] text-muted">12-month monthly average {money(avgMonthly)}</p>
        </div>
        <div className="tile-ink p-6">
          <p className="text-[13px] text-white/70">Recurring commitments</p>
          <MoneyFigure value={recurringMonthly} className="mt-4 block text-[42px]" />
          <p className="mt-4 text-[12px] text-white/50">{recurring.length} series · normalised per month</p>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Largest category</p>
          {top ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <CategoryIcon icon={cat.get(top.id)?.icon} color={cat.get(top.id)?.color} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-display text-[20px]">{cat.get(top.id)?.name ?? 'Uncategorised'}</p>
                  <p className="text-[13px] text-muted num">
                    {money(top.total)} · {Math.round(top.share * 100)}%
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-muted">No expenses in this period.</p>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-7" aria-labelledby="et">
          <TileHeader id="et" title="Expense trend" subtitle="Last 12 months · current month highlighted" />
          <TrendChart points={m.months} color="#161615" seriesLabel="Expenses" height={260} />
        </Tile>
        <Tile className="xl:col-span-5" aria-labelledby="lg">
          <TileHeader id="lg" title="Largest expenses" subtitle={formatRange(range)} />
          {m.largest.length === 0 ? (
            <EmptyState compact icon={<Inbox />} title="No expenses" />
          ) : (
            <ol className="flex flex-col gap-1">
              {m.largest.map((t, i) => {
                const c = t.categoryId ? cat.get(t.categoryId) : undefined
                return (
                  <li key={t.id}>
                    <button onClick={() => tx.open({ edit: t })} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/70">
                      <span className="figure w-6 text-[20px] text-subtle">{i + 1}</span>
                      <CategoryIcon icon={c?.icon} color={c?.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{t.description}</span>
                        <span className="text-[12px] text-muted">
                          {formatDate(t.date, 'short')} · {c?.name}
                        </span>
                      </span>
                      <span className="text-[13.5px] font-medium num">{money(t.amount)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </Tile>
      </div>

      <Tile className="mt-4" aria-labelledby="sbc">
        <TileHeader id="sbc" title="Spending by category" subtitle={`${formatRange(range)} · change is like-for-like vs previous period`} action={<Button variant="ghost" size="sm" onClick={() => setCatOpen(true)}><Plus /> Category</Button>} />
        {m.slices.length === 0 ? (
          <EmptyState compact icon={<Tags />} title="No spending to break down" />
        ) : (
          <>
            <SegmentBar segments={m.slices.map((s) => ({ id: s.id, value: s.total, color: cat.get(s.id)?.color ?? '#d8d2c4', label: cat.get(s.id)?.name ?? 'Uncategorised' }))} />
            <div className="mt-5 overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <caption className="sr-only">Spending by category</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th scope="col" className="py-2.5 font-medium">Category</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Spent</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Share</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Change</th>
                    <th scope="col" className="py-2.5 pl-6 font-medium">This month's budget</th>
                  </tr>
                </thead>
                <tbody>
                  {m.slices.map((s) => {
                    const c = cat.get(s.id)
                    const u = budgetsByCat.get(s.id)
                    return (
                      <tr key={s.id} className="border-b border-line last:border-0">
                        <td className="py-2.5">
                          <button className="flex items-center gap-2.5 hover:underline" onClick={() => setFilter({ ...filter, categoryId: s.id })}>
                            <CategoryIcon icon={c?.icon} color={c?.color} size="sm" />
                            {c?.name ?? 'Uncategorised'}
                          </button>
                        </td>
                        <td className="py-2.5 text-right font-medium num">{money(s.total)}</td>
                        <td className="py-2.5 text-right text-muted num">{(s.share * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right">
                          <Trend pct={pctChange(m.curLikeMap.get(s.id) ?? 0, m.prevMap.get(s.id) ?? 0)} goodWhenUp={false} />
                        </td>
                        <td className="py-2.5 pl-6">
                          {u ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink/[0.06]">
                                <div className={cn('h-full rounded-full', u.state === 'over' ? 'bg-loss' : u.state === 'warning' ? 'bg-sun-deep' : 'bg-ink')} style={{ width: `${Math.min(100, u.ratio * 100)}%` }} />
                              </div>
                              <span className={cn('text-[12px] num', u.state === 'over' ? 'text-loss' : 'text-muted')}>{Math.round(u.ratio * 100)}%</span>
                            </div>
                          ) : (
                            <Link to={`/budgets?new=${s.id}`} className="text-[12px] text-subtle hover:text-ink">
                              + Set budget
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tile>

      <Tile className="mt-4" aria-labelledby="rex">
        <TileHeader id="rex" title="Recurring expenses" subtitle="Subscriptions, rent and retainers" to="/transactions?view=recurring" />
        {recurring.length === 0 ? (
          <EmptyState compact icon={<Repeat />} title="No recurring expenses" description="Mark subscriptions as recurring to track their monthly cost." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {recurring.map((r) => {
              const c = r.tx.categoryId ? cat.get(r.tx.categoryId) : undefined
              return (
                <li key={r.tx.id} className="flex items-center gap-3 rounded-2xl bg-white/55 p-3 ring-1 ring-line">
                  <CategoryIcon icon={c?.icon} color={c?.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{r.tx.description}</span>
                    <span className="text-[12px] text-muted">
                      {r.tx.recurring!.frequency[0].toUpperCase() + r.tx.recurring!.frequency.slice(1)} · next {relativeDays(r.next, today)}
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-medium num">{money(r.tx.amount)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Tile>

      <section className="tile mt-4 p-4 sm:p-6" aria-labelledby="exp-list">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="exp-list" className="font-display text-[19px]">
            Expense records
          </h2>
          <Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => (exportTransactionsCSV(rows, data, ws, 'expenses'), toast.success(`Exported ${rows.length} records`))}>
            <Download /> Export CSV
          </Button>
        </div>
        <FilterBar filter={filter} onChange={setFilter} lockType="expense" className="mb-4" />
        <TransactionTable caption="Expense records" rows={rows.slice(0, 60)} sort={sort} onSort={setSort} empty={<EmptyState icon={<Inbox />} title="No expenses match" description="Try another category, amount or period." />} />
        {rows.length > 60 && (
          <p className="mt-3 text-center text-[12.5px] text-muted">
            Showing 60 of {rows.length}.{' '}
            <Link to="/transactions" className="underline">
              See all in Transactions
            </Link>
          </p>
        )}
      </section>
      <CategoryDialog open={catOpen} onOpenChange={setCatOpen} defaultKind="expense" />
    </>
  )
}
