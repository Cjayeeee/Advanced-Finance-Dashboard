import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Info } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { useActiveWorkspace } from '@/store/app-store'
import { useRange } from '@/store/range'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { useReducedMotion } from '@/hooks/use-media'
import { PageIntro } from '@/components/page'
import { Tile, TileHeader } from '@/components/tile'
import { DateRangePicker } from '@/components/date-range-picker'
import { CategoryIcon } from '@/components/category-icon'
import { Sparkline } from '@/components/sparkline'
import { Trend } from '@/components/trend'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { CashflowChart } from '@/features/charts/cashflow-chart'
import { PillBar } from '@/features/charts/lollipop'
import { exportTransactionsCSV } from '@/features/transactions/export'
import { accountBalances, budgetUsage, burn, byCategory, byClient, comparisonRanges, invoiceViews, series, totalBalance, totals } from '@/lib/finance'
import { addDays, addMonths, endOfMonth, formatRange, inRange, monthLabel, startOfMonth, todayISO, type DateRange } from '@/lib/dates'
import { csvAmount, downloadFile, toCSV } from '@/lib/csv'
import { pctChange } from '@/lib/money'
import { cn } from '@/lib/utils'

type Tab = 'summary' | 'pnl' | 'cashflow' | 'categories' | 'clients' | 'budgets'

export default function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'summary'
  const { ws, data } = useActiveWorkspace()
  const { range } = useRange()
  const terms = useTerms()
  const records = data.transactions.filter((t) => inRange(t.date, range))

  return (
    <>
      <PageIntro
        title="Reports"
        description={`Cash-basis reports for ${formatRange(range)}. Every figure comes from the same transaction records and date filter.`}
        actions={
          <>
            <DateRangePicker className="sm:hidden" />
            <Button variant="secondary" disabled={!records.length} onClick={() => (exportTransactionsCSV(records, data, ws, 'records'), toast.success(`Exported ${records.length} underlying records`))}>
              <Download /> Export records
            </Button>
          </>
        }
      />
      <div className="-mx-1 mb-4 overflow-x-auto px-1 no-scrollbar">
        <Segmented
          label="Report"
          value={tab}
          onChange={(t) => setParams({ tab: t })}
          options={[
            { value: 'summary', label: 'Summary' },
            { value: 'pnl', label: 'Profit & loss' },
            { value: 'cashflow', label: 'Cash flow' },
            { value: 'categories', label: 'Categories' },
            { value: 'clients', label: terms.clients },
            { value: 'budgets', label: 'Budget vs actual' },
          ]}
          className="whitespace-nowrap"
        />
      </div>
      <div key={tab} className="animate-rise">
        {tab === 'summary' && <Summary range={range} />}
        {tab === 'pnl' && <ProfitLoss range={range} />}
        {tab === 'cashflow' && <CashFlowReport range={range} />}
        {tab === 'categories' && <Categories range={range} />}
        {tab === 'clients' && <Clients range={range} />}
        {tab === 'budgets' && <BudgetReport />}
      </div>
      <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        These are simple cash-basis summaries of recorded transactions. They are not a statutory profit & loss statement, balance sheet or tax filing. Transfers between your own accounts are excluded from income and expenses.
      </p>
    </>
  )
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Download /> CSV
    </Button>
  )
}

const fileName = (s: string) => `${s}-${todayISO()}.csv`

/* ─────────────────────────── Summary ─────────────────────────── */

function Summary({ range }: { range: DateRange }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const terms = useTerms()
  const { current, previous } = comparisonRanges(range)
  const cur = totals(data.transactions, range)
  const curLike = totals(data.transactions, current)
  const prev = totals(data.transactions, previous)
  const yoyRange = { start: addMonths(current.start, -12), end: addMonths(current.end, -12) }
  const yoy = totals(data.transactions, yoyRange)
  const months = series(data.transactions, range, 'month').filter((p) => !p.future)
  const avgNet = months.length ? Math.round(months.reduce((s, p) => s + p.net, 0) / months.length) : 0
  const margin = cur.income > 0 ? (cur.net / cur.income) * 100 : null

  const kpis = [
    { label: terms.income, value: money(cur.income), pct: pctChange(curLike.income, prev.income), up: true },
    { label: 'Expenses', value: money(cur.expenses), pct: pctChange(curLike.expenses, prev.expenses), up: false },
    { label: 'Net profit', value: money(cur.net), pct: pctChange(curLike.net, prev.net), up: true },
    { label: 'Profit margin', value: margin === null ? '—' : `${margin.toFixed(1)}%`, pct: undefined, up: true },
    { label: 'Avg monthly net', value: money(avgNet), pct: undefined, up: true },
  ]

  return (
    <>
      <section className="tile grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-3 xl:grid-cols-5" aria-label="Key figures">
        {kpis.map((k, i) => (
          <div key={k.label} className={cn('p-5', i > 0 && 'border-l border-line', i >= 2 && 'max-sm:border-t')}>
            <p className="text-[12.5px] text-muted">{k.label}</p>
            <p className="figure mt-3 text-[28px] sm:text-[32px]">{k.value}</p>
            {k.pct !== undefined && <Trend pct={k.pct} goodWhenUp={k.up} className="mt-2" />}
          </div>
        ))}
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-8" aria-labelledby="s-cf">
          <TileHeader id="s-cf" title="Income vs expenses" subtitle={formatRange(range)} />
          <CashflowChart range={range} height={300} />
        </Tile>
        <Tile className="xl:col-span-4" aria-labelledby="s-g">
          <TileHeader id="s-g" title={`${terms.income} growth`} subtitle="Like-for-like comparisons" />
          <dl className="flex flex-col divide-y divide-line">
            {[
              { label: 'vs previous period', sub: formatRange(previous), a: curLike.income, b: prev.income },
              { label: 'vs same period last year', sub: formatRange(yoyRange), a: curLike.income, b: yoy.income },
            ].map((r) => (
              <div key={r.label} className="py-4">
                <dt className="flex items-center justify-between text-[13.5px]">
                  {r.label}
                  <Trend pct={r.b > 0 ? pctChange(r.a, r.b) : null} />
                </dt>
                <dd className="mt-1 text-[12px] text-muted num">
                  {money(r.a)} vs {money(r.b)} · {r.sub}
                </dd>
              </div>
            ))}
            <div className="py-4">
              <dt className="text-[13.5px]">Expense growth vs previous period</dt>
              <dd className="mt-1 flex items-center justify-between text-[12px] text-muted num">
                {money(curLike.expenses)} vs {money(prev.expenses)}
                <Trend pct={pctChange(curLike.expenses, prev.expenses)} goodWhenUp={false} />
              </dd>
            </div>
          </dl>
        </Tile>
      </div>
    </>
  )
}

/* ─────────────────────────── P&L ─────────────────────────── */

function ProfitLoss({ range }: { range: DateRange }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const terms = useTerms()
  const { previous, current } = comparisonRanges(range)
  const months = useMemo(() => series(data.transactions, range, 'month'), [data.transactions, range])
  const inc = byCategory(data.transactions, range, 'income')
  const exp = byCategory(data.transactions, range, 'expense')
  const prevInc = new Map(byCategory(data.transactions, previous, 'income').map((s) => [s.id, s.total]))
  const prevExp = new Map(byCategory(data.transactions, previous, 'expense').map((s) => [s.id, s.total]))
  const curLikeInc = new Map(byCategory(data.transactions, current, 'income').map((s) => [s.id, s.total]))
  const curLikeExp = new Map(byCategory(data.transactions, current, 'expense').map((s) => [s.id, s.total]))
  const t = totals(data.transactions, range)
  const p = totals(data.transactions, previous)
  const tl = totals(data.transactions, current)
  const name = (id: string) => cat.get(id)?.name ?? 'Uncategorised'

  const exportCSV = () => {
    const rows: unknown[][] = []
    inc.forEach((s) => rows.push([terms.income, name(s.id), csvAmount(s.total), csvAmount(prevInc.get(s.id) ?? 0)]))
    rows.push([terms.income, 'Total', csvAmount(t.income), csvAmount(p.income)])
    exp.forEach((s) => rows.push(['Expenses', name(s.id), csvAmount(s.total), csvAmount(prevExp.get(s.id) ?? 0)]))
    rows.push(['Expenses', 'Total', csvAmount(t.expenses), csvAmount(p.expenses)])
    rows.push(['Net profit', '', csvAmount(t.net), csvAmount(p.net)])
    downloadFile(fileName('profit-and-loss'), toCSV(['Section', 'Category', `Current (${formatRange(range)})`, `Previous (${formatRange(previous)})`], rows))
    toast.success('P&L exported')
  }

  const Row = ({ label, a, b, al, strong, icon }: { label: string; a: number; b: number; al: number; strong?: boolean; icon?: React.ReactNode }) => (
    <tr className={cn('border-b border-line', strong && 'font-medium')}>
      <td className="py-2.5 pl-1">
        <span className="flex items-center gap-2.5">
          {icon}
          {label}
        </span>
      </td>
      <td className="py-2.5 text-right num">{money(a)}</td>
      <td className="py-2.5 text-right text-muted num">{money(b)}</td>
      <td className="py-2.5 pr-1 text-right">
        <Trend pct={pctChange(al, b)} />
      </td>
    </tr>
  )

  return (
    <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
      <Tile className="xl:col-span-7" aria-labelledby="pl">
        <TileHeader id="pl" title="Profit & loss (cash basis)" subtitle={`${formatRange(range)} compared with ${formatRange(previous)}`} action={<ExportButton onClick={exportCSV} />} />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[520px] text-[13.5px]">
            <caption className="sr-only">Profit and loss</caption>
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pl-1 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Current</th>
                <th scope="col" className="py-2 text-right font-medium">Previous</th>
                <th scope="col" className="py-2 pr-1 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th colSpan={4} scope="rowgroup" className="eyebrow pt-4 pb-1 pl-1 text-left">
                  {terms.income}
                </th>
              </tr>
              {inc.map((s) => (
                <Row key={s.id} label={name(s.id)} a={s.total} b={prevInc.get(s.id) ?? 0} al={curLikeInc.get(s.id) ?? 0} icon={<CategoryIcon icon={cat.get(s.id)?.icon} color={cat.get(s.id)?.color} size="sm" className="size-6 [&_svg]:size-3" />} />
              ))}
              <Row label={`Total ${terms.incomeLower}`} a={t.income} b={p.income} al={tl.income} strong />
              <tr>
                <th colSpan={4} scope="rowgroup" className="eyebrow pt-5 pb-1 pl-1 text-left">
                  Expenses
                </th>
              </tr>
              {exp.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2.5 pl-1">
                    <span className="flex items-center gap-2.5">
                      <CategoryIcon icon={cat.get(s.id)?.icon} color={cat.get(s.id)?.color} size="sm" className="size-6 [&_svg]:size-3" />
                      {name(s.id)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right num">{money(s.total)}</td>
                  <td className="py-2.5 text-right text-muted num">{money(prevExp.get(s.id) ?? 0)}</td>
                  <td className="py-2.5 pr-1 text-right">
                    <Trend pct={pctChange(curLikeExp.get(s.id) ?? 0, prevExp.get(s.id) ?? 0)} goodWhenUp={false} />
                  </td>
                </tr>
              ))}
              <tr className="border-b border-line font-medium">
                <td className="py-2.5 pl-1">Total expenses</td>
                <td className="py-2.5 text-right num">{money(t.expenses)}</td>
                <td className="py-2.5 text-right text-muted num">{money(p.expenses)}</td>
                <td className="py-2.5 pr-1 text-right">
                  <Trend pct={pctChange(tl.expenses, p.expenses)} goodWhenUp={false} />
                </td>
              </tr>
              <tr className="bg-sun-wash/80 text-[15px] font-semibold">
                <td className="rounded-l-2xl py-3.5 pl-3">Net profit</td>
                <td className={cn('py-3.5 text-right num', t.net < 0 && 'text-loss')}>{money(t.net)}</td>
                <td className="py-3.5 text-right text-muted num">{money(p.net)}</td>
                <td className="rounded-r-2xl py-3.5 pr-3 text-right">
                  <Trend pct={pctChange(tl.net, p.net)} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-subtle">“Change” compares like-for-like days when the current period is still in progress.</p>
      </Tile>
      <Tile className="xl:col-span-5" aria-labelledby="plm">
        <TileHeader id="plm" title="Monthly P&L" subtitle="Net profit each month" />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[360px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th scope="col" className="py-2 font-medium">Month</th>
                <th scope="col" className="py-2 text-right font-medium">{terms.income}</th>
                <th scope="col" className="py-2 text-right font-medium">Expenses</th>
                <th scope="col" className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key} className={cn('border-b border-line last:border-0', m.future && 'opacity-40')}>
                  <td className="py-2">{m.fullLabel}</td>
                  <td className="py-2 text-right num">{money(m.income)}</td>
                  <td className="py-2 text-right num">{money(m.expenses)}</td>
                  <td className={cn('py-2 text-right font-medium num', m.net < 0 && 'text-loss')}>{money(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tile>
    </div>
  )
}

/* ─────────────────────────── Cash flow ─────────────────────────── */

function CashFlowReport({ range }: { range: DateRange }) {
  const { ws, data } = useActiveWorkspace()
  const { money, compact } = useFormat()
  const { acc } = useLookups()
  const reduced = useReducedMotion()
  const today = todayISO()
  const months = useMemo(() => series(data.transactions, range, 'month').filter((m) => !m.future), [data.transactions, range])
  const balance = totalBalance(data.accounts, data.transactions)
  const b = burn(data.transactions, balance, ws.burnWindow, today)

  // Opening/closing balances per month (recorded)
  const rows = months.map((m) => {
    const opening = totalBalance(data.accounts, data.transactions, addDays(m.start, -1))
    const closing = totalBalance(data.accounts, data.transactions, m.end > today ? today : m.end)
    return { ...m, opening, closing }
  })

  // Projection: next 3 months at average monthly net of the burn window (ESTIMATE)
  const avgNet = b.months.length ? -b.avgNetBurn : 0
  const projection = b.sufficient
    ? Array.from({ length: 3 }, (_, i) => {
        const s = addMonths(startOfMonth(today), i + 1)
        return { key: s, label: monthLabel(s.slice(0, 7)).slice(0, 3), value: (balance + avgNet * (i + 1)) / 100, projected: true }
      })
    : []
  const chart = [...rows.map((r) => ({ key: r.key, label: r.label, value: r.closing / 100, projected: false })), ...projection]
  const transfers = data.transactions.filter((t) => t.type === 'transfer' && inRange(t.date, range))
  const transferTotal = transfers.reduce((s, t) => s + t.amount, 0)
  const balances = accountBalances(data.accounts, data.transactions)

  const exportCSV = () => {
    downloadFile(fileName('cash-flow'), toCSV(['Month', 'Opening balance', 'Cash in', 'Cash out', 'Net cash flow', 'Closing balance'], rows.map((r) => [r.fullLabel, csvAmount(r.opening), csvAmount(r.income + 0), csvAmount(r.expenses), csvAmount(r.net), csvAmount(r.closing)])))
    toast.success('Cash flow exported')
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-8" aria-labelledby="bal-t">
          <TileHeader id="bal-t" title="Balance over time" subtitle="Recorded month-end balances, plus a 3-month estimate (hatched)" />
          {chart.length === 0 ? (
            <EmptyState compact title="No data in this period" />
          ) : (
            <div className="-ml-2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} barCategoryGap="30%">
                  <defs>
                    <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="7" height="7" fill="#fbedb2" />
                      <line x1="0" y1="0" x2="0" y2="7" stroke="#e2b41c" strokeWidth="2" />
                    </pattern>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgb(22 22 21 / 0.07)" strokeDasharray="3 5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#77756f' }} dy={6} />
                  <YAxis tickLine={false} axisLine={false} width={60} tick={{ fontSize: 11.5, fill: '#a3a19a' }} tickFormatter={(v: number) => compact(v * 100)} />
                  <Tooltip
                    cursor={{ fill: 'rgb(22 22 21 / 0.04)', radius: 12 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as (typeof chart)[number]
                      return (
                        <div className="rounded-2xl bg-ink px-3.5 py-2.5 text-[13px] text-white shadow-[var(--shadow-ink)]">
                          <p className="text-[12px] text-white/60">{monthLabel(p.key.slice(0, 7))}</p>
                          <p className="num">
                            {p.projected ? 'Estimated' : 'Closing'} balance {money(Math.round(p.value * 100))}
                          </p>
                          {p.projected && <p className="text-[11.5px] text-sun">Estimate, not a recorded figure</p>}
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" shape={<PillBar />} isAnimationActive={!reduced}>
                    {chart.map((c) => (
                      <Cell key={c.key} fill={c.projected ? 'url(#hatch)' : '#161615'} />
                    ))}
                  </Bar>
                  <Line dataKey="value" stroke="#e2b41c" strokeWidth={1.5} dot={false} type="monotone" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {!b.sufficient && <p className="mt-2 text-[12px] text-muted">The estimate needs at least two complete months of history.</p>}
        </Tile>
        <section className="tile-ink p-6 xl:col-span-4" aria-labelledby="burn-h">
          <h2 id="burn-h" className="font-display text-[19px]">
            Burn & runway
          </h2>
          <p className="mt-0.5 text-[12px] text-white/50">Estimate · last {ws.burnWindow} complete months</p>
          <dl className="mt-5 flex flex-col gap-4">
            <div>
              <dt className="text-[12px] text-white/55">Available balance (recorded)</dt>
              <dd className="figure mt-1 text-[34px]">{money(balance)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.06] p-3">
                <dt className="text-[11.5px] text-white/50">Avg net burn</dt>
                <dd className="mt-0.5 font-medium num">{b.sufficient ? (b.avgNetBurn > 0 ? money(b.avgNetBurn) : 'None') : '—'}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.06] p-3">
                <dt className="text-[11.5px] text-white/50">Avg gross burn</dt>
                <dd className="mt-0.5 font-medium num">{b.sufficient ? money(b.avgGrossBurn) : '—'}</dd>
              </div>
            </div>
            <div className="hatch-light rounded-2xl bg-white/[0.06] p-4">
              <dt className="text-[11.5px] text-white/50">Estimated runway</dt>
              <dd className="figure mt-1 text-[30px] text-sun">{!b.sufficient ? 'Not enough data' : b.runwayMonths === null ? 'Not burning cash' : `${b.runwayMonths.toFixed(1)} months`}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11.5px] leading-relaxed text-white/45">
            Net burn = average of (cash out − cash in) per complete month. Runway = available balance ÷ net burn, shown only when net burn is positive. Change the window in Settings → Reporting.
          </p>
        </section>
      </div>

      <Tile className="mt-4" aria-labelledby="cft">
        <TileHeader id="cft" title="Monthly cash flow statement" subtitle={formatRange(range)} action={<ExportButton onClick={exportCSV} />} />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="py-2 font-medium">Month</th>
                <th scope="col" className="py-2 text-right font-medium">Opening</th>
                <th scope="col" className="py-2 text-right font-medium">Cash in</th>
                <th scope="col" className="py-2 text-right font-medium">Cash out</th>
                <th scope="col" className="py-2 text-right font-medium">Net</th>
                <th scope="col" className="py-2 text-right font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="py-2.5">{r.fullLabel}</td>
                  <td className="py-2.5 text-right text-muted num">{money(r.opening)}</td>
                  <td className="py-2.5 text-right num">{money(r.income)}</td>
                  <td className="py-2.5 text-right num">{money(r.expenses)}</td>
                  <td className={cn('py-2.5 text-right font-medium num', r.net < 0 ? 'text-loss' : 'text-gain')}>{money(r.net, { signed: true })}</td>
                  <td className="py-2.5 text-right font-medium num">{money(r.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-subtle">Cash in/out are net of refunds. {transfers.length} transfers ({money(transferTotal)}) between your accounts in this period are excluded because they don't change your total balance.</p>
      </Tile>

      <Tile className="mt-4" aria-labelledby="accb">
        <TileHeader id="accb" title="Balances by account" subtitle="As of today" />
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.accounts.map((a) => (
            <li key={a.id} className={cn('rounded-2xl bg-white/55 p-4 ring-1 ring-line', a.archived && 'opacity-50')}>
              <p className="text-[12.5px] capitalize text-muted">
                {acc.get(a.id)?.name} · {a.kind}
              </p>
              <p className={cn('figure mt-2 text-[24px]', (balances.get(a.id) ?? 0) < 0 && 'text-loss')}>{money(balances.get(a.id) ?? 0)}</p>
            </li>
          ))}
        </ul>
      </Tile>
    </>
  )
}

/* ─────────────────────────── Categories ─────────────────────────── */

function Categories({ range }: { range: DateRange }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const slices = byCategory(data.transactions, range, 'expense')
  const months = useMemo(() => {
    const ms: DateRange[] = []
    let s = startOfMonth(range.start)
    while (s <= range.end && ms.length < 24) {
      ms.push({ start: s, end: endOfMonth(s) })
      s = addMonths(s, 1)
    }
    return ms
  }, [range])
  const perMonth = (id: string) => months.map((m) => byCategory(data.transactions, m, 'expense').find((s) => s.id === id)?.total ?? 0)

  const exportCSV = () => {
    downloadFile(fileName('expense-categories'), toCSV(['Category', 'Total', 'Share %', 'Transactions', 'Monthly average', ...months.map((m) => monthLabel(m.start.slice(0, 7)))], slices.map((s) => { const pm = perMonth(s.id); return [cat.get(s.id)?.name ?? 'Uncategorised', csvAmount(s.total), (s.share * 100).toFixed(1), s.count, csvAmount(Math.round(s.total / Math.max(1, months.length))), ...pm.map(csvAmount)] })))
    toast.success('Category analysis exported')
  }

  return (
    <Tile aria-labelledby="ca">
      <TileHeader id="ca" title="Expense category analysis" subtitle={`${formatRange(range)} · ${months.length} months`} action={<ExportButton onClick={exportCSV} />} />
      {slices.length === 0 ? (
        <EmptyState compact title="No expenses in this period" />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 font-medium">Monthly trend</th>
                <th scope="col" className="py-2 text-right font-medium">Avg / month</th>
                <th scope="col" className="py-2 text-right font-medium">Records</th>
                <th scope="col" className="py-2 text-right font-medium">Share</th>
                <th scope="col" className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => {
                const c = cat.get(s.id)
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2.5">
                        <CategoryIcon icon={c?.icon} color={c?.color} size="sm" />
                        {c?.name ?? 'Uncategorised'}
                      </span>
                    </td>
                    <td className="py-3">
                      <Sparkline values={perMonth(s.id)} width={120} height={28} stroke={c?.color && c.color !== '#d8d2c4' ? c.color : '#161615'} />
                    </td>
                    <td className="py-3 text-right num">{money(Math.round(s.total / Math.max(1, months.length)))}</td>
                    <td className="py-3 text-right text-muted num">{s.count}</td>
                    <td className="py-3 text-right num">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${s.share * 100}%` }} />
                        </span>
                        {(s.share * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium num">{money(s.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Tile>
  )
}

/* ─────────────────────────── Clients ─────────────────────────── */

function Clients({ range }: { range: DateRange }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { client } = useLookups()
  const terms = useTerms()
  const { previous, current } = comparisonRanges(range)
  const slices = byClient(data.transactions, range)
  const prev = new Map(byClient(data.transactions, previous).map((s) => [s.id, s.total]))
  const curLike = new Map(byClient(data.transactions, current).map((s) => [s.id, s.total]))
  const views = invoiceViews(data.invoices, data.transactions)
  const inv = (id: string) => {
    const vs = views.filter((v) => v.invoice.clientId === id && v.status !== 'draft' && v.status !== 'void')
    return { invoiced: vs.filter((v) => inRange(v.invoice.issueDate, range)).reduce((s, v) => s + v.amounts.total, 0), outstanding: vs.reduce((s, v) => s + v.outstanding, 0) }
  }
  const nameOf = (id: string) => client.get(id)?.name ?? (id === 'unassigned' ? `No ${terms.client.toLowerCase()}` : 'Unknown')
  const exportCSV = () => {
    downloadFile(fileName('client-revenue'), toCSV([terms.client, 'Received', 'Share %', 'Payments', 'Previous period', 'Invoiced in period', 'Outstanding (all time)'], slices.map((s) => [nameOf(s.id), csvAmount(s.total), (s.share * 100).toFixed(1), s.count, csvAmount(prev.get(s.id) ?? 0), csvAmount(inv(s.id).invoiced), csvAmount(inv(s.id).outstanding)])))
    toast.success(`${terms.client} revenue exported`)
  }
  return (
    <Tile aria-labelledby="cr">
      <TileHeader id="cr" title={`${terms.client} revenue analysis`} subtitle={`Payments received · ${formatRange(range)}`} action={<ExportButton onClick={exportCSV} />} />
      {slices.length === 0 ? (
        <EmptyState compact title={`No ${terms.incomeLower} in this period`} />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="py-2 font-medium">{terms.client}</th>
                <th scope="col" className="py-2 text-right font-medium">Received</th>
                <th scope="col" className="py-2 text-right font-medium">Share</th>
                <th scope="col" className="py-2 text-right font-medium">vs previous</th>
                <th scope="col" className="py-2 text-right font-medium">Invoiced</th>
                <th scope="col" className="py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s, i) => {
                const iv = inv(s.id)
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2.5">
                        <span className={cn('grid size-7 place-items-center rounded-full text-[11px] font-semibold', i === 0 ? 'bg-sun' : 'bg-ink text-white')}>{nameOf(s.id)[0]}</span>
                        {nameOf(s.id)}
                        <span className="text-[12px] text-muted">{s.count} payments</span>
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium num">{money(s.total)}</td>
                    <td className="py-3 text-right num">{(s.share * 100).toFixed(1)}%</td>
                    <td className="py-3 text-right">
                      <Trend pct={pctChange(curLike.get(s.id) ?? 0, prev.get(s.id) ?? 0)} />
                    </td>
                    <td className="py-3 text-right text-muted num">{money(iv.invoiced)}</td>
                    <td className={cn('py-3 text-right num', iv.outstanding > 0 ? 'text-ink' : 'text-subtle')}>{money(iv.outstanding)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Tile>
  )
}

/* ─────────────────────────── Budget vs actual ─────────────────────────── */

function BudgetReport() {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const today = todayISO()
  const monthsBack = [0, 1, 2, 3, 4, 5].map((i) => addMonths(startOfMonth(today), -i))
  const budgets = data.budgets.filter((b) => b.period === 'monthly')
  const name = (id: string | null) => (id ? (cat.get(id)?.name ?? 'Category') : 'Overall')
  const exportCSV = () => {
    const rows: unknown[][] = []
    for (const b of budgets) for (const m of monthsBack) { const u = budgetUsage(b, data.transactions, m === startOfMonth(today) ? today : endOfMonth(m)); rows.push([name(b.categoryId), monthLabel(m.slice(0, 7)), csvAmount(b.amount), csvAmount(u.spent), csvAmount(u.remaining), (u.ratio * 100).toFixed(1)]) }
    downloadFile(fileName('budget-vs-actual'), toCSV(['Budget', 'Month', 'Limit', 'Actual', 'Remaining', 'Used %'], rows))
    toast.success('Budget report exported')
  }
  return (
    <Tile aria-labelledby="bva-r">
      <TileHeader id="bva-r" title="Budget vs actual" subtitle="Monthly budgets · last 6 months · uses each budget's current limit" action={<ExportButton onClick={exportCSV} />} />
      {budgets.length === 0 ? (
        <EmptyState compact title="No monthly budgets" description="Create budgets to compare them with actual spending." />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-ink text-left text-[12px] text-muted">
                <th scope="col" className="py-2 font-medium">Budget</th>
                <th scope="col" className="py-2 text-right font-medium">Limit</th>
                {monthsBack.map((m) => (
                  <th key={m} scope="col" className="py-2 text-right font-medium">
                    {monthLabel(m.slice(0, 7))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <th scope="row" className="py-3 text-left font-medium">{name(b.categoryId)}</th>
                  <td className="py-3 text-right text-muted num">{money(b.amount)}</td>
                  {monthsBack.map((m) => {
                    const u = budgetUsage(b, data.transactions, m === startOfMonth(today) ? today : endOfMonth(m))
                    return (
                      <td key={m} className="py-3 text-right">
                        <span className={cn('block num', u.state === 'over' && 'text-loss')}>{money(u.spent)}</span>
                        <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
                          <span className={cn('block h-full rounded-full', u.state === 'over' ? 'bg-loss' : u.state === 'warning' ? 'bg-sun-deep' : 'bg-ink')} style={{ width: `${Math.min(100, u.ratio * 100)}%` }} />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tile>
  )
}
